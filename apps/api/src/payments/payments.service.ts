import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { formatHalalas, PROVIDER_ACCEPT_MINUTES } from '@rafeeq/shared';
import type { AuthUser } from '../auth/auth-user.js';
import type { Env } from '../config/env.js';
import type { Database, Tx } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { availabilitySlots, bookings, orderItems, orders, payments, providers, services } from '../db/schema.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { recordStatus } from '../common/status.js';
import { convertHoldToBooked, lockBooking, transitionBooking } from '../bookings/lifecycle.js';
import { lockOrder, reserveStock, transitionOrder } from '../shop/order-lifecycle.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { SANDBOX_CARDS, SandboxGateway, type PaymentGateway, type PaymentMethod } from './gateway.js';

export type Target = { bookingId: string; orderId?: undefined } | { orderId: string; bookingId?: undefined };

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');
  readonly gateway: PaymentGateway = new SandboxGateway();

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  /** Start paying for a booking or an order. Reuses an open checkout for the same target. */
  async checkout(user: AuthUser, target: Target, method: PaymentMethod) {
    return this.db.transaction(async (tx) => {
      let amount: number;
      if (target.bookingId) {
        const b = await lockBooking(tx, target.bookingId);
        if (b.pilgrimId !== user.id) throw forbidden('booking.not_yours', 'Not your booking');
        if (b.status !== 'pending_payment') throw conflict('payment.already_paid', 'This booking is not waiting for payment');
        if (b.holdExpiresAt && b.holdExpiresAt < new Date()) {
          throw conflict('booking.hold_expired', 'The time to pay ran out. Please book again.');
        }
        amount = b.totalHalalas;
      } else {
        const o = await lockOrder(tx, target.orderId!);
        if (o.pilgrimId !== user.id) throw forbidden('order.not_yours', 'Not your order');
        if (o.status !== 'pending_payment') throw conflict('payment.already_paid', 'This order is not waiting for payment');
        amount = o.totalHalalas;
      }
      const targetWhere = target.bookingId ? eq(payments.bookingId, target.bookingId) : eq(payments.orderId, target.orderId!);
      const [open] = await tx
        .select()
        .from(payments)
        .where(and(targetWhere, eq(payments.status, 'initiated')))
        .limit(1);
      if (open) return this.checkoutView(open);

      const { gatewayRef } = await this.gateway.createCheckout({
        amountHalalas: amount,
        reference: target.bookingId ?? target.orderId!,
        method,
      });
      const [p] = await tx
        .insert(payments)
        .values({ ...target, gateway: this.gateway.name, gatewayRef, method, amountHalalas: amount, status: 'initiated' })
        .returning();
      await recordStatus(tx, { entityType: 'payment', entityId: p.id, from: null, to: 'initiated', actorId: user.id });
      return this.checkoutView(p);
    });
  }

  private checkoutView(p: typeof payments.$inferSelect) {
    return {
      paymentId: p.id,
      amountHalalas: p.amountHalalas,
      method: p.method,
      gateway: p.gateway,
      status: p.status,
      ...(p.gateway === 'sandbox' ? { sandbox: { successCard: SANDBOX_CARDS.success, declinedCard: SANDBOX_CARDS.declined } } : {}),
    };
  }

  /**
   * Sandbox stand-in for the gateway's payment page + webhook. Only in demo mode.
   * The pilgrim's app sends the test card; success and decline behave like a real gateway.
   */
  async sandboxComplete(user: AuthUser, paymentId: string, cardNumber: string) {
    if (!this.config.get('DEMO_MODE', { infer: true })) throw notFound('payment');
    const [p] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    if (!p) throw notFound('payment');
    await this.assertPayer(user, p);
    const digits = cardNumber.replace(/\s+/g, '');
    const outcome = digits === SANDBOX_CARDS.declined ? 'failed' : digits === SANDBOX_CARDS.success ? 'succeeded' : null;
    if (!outcome) throw badRequest('payment.unknown_test_card', 'Use a sandbox test card');
    return this.handleGatewayResult(p.gatewayRef!, outcome);
  }

  private async assertPayer(user: AuthUser, p: typeof payments.$inferSelect) {
    if (p.bookingId) {
      const [b] = await this.db.select({ pilgrimId: bookings.pilgrimId }).from(bookings).where(eq(bookings.id, p.bookingId));
      if (b?.pilgrimId !== user.id) throw forbidden('payment.not_yours', 'Not your payment');
    } else if (p.orderId) {
      const [o] = await this.db.select({ pilgrimId: orders.pilgrimId }).from(orders).where(eq(orders.id, p.orderId));
      if (o?.pilgrimId !== user.id) throw forbidden('payment.not_yours', 'Not your payment');
    }
  }

  /** What a gateway webhook calls. Idempotent: a repeated success is ignored. */
  async handleGatewayResult(gatewayRef: string, outcome: 'succeeded' | 'failed') {
    const result = await this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.gatewayRef, gatewayRef)).for('update');
      if (!p) throw notFound('payment');
      if (p.status !== 'initiated') return { payment: p, notify: null as null | (() => Promise<void>) };

      if (outcome === 'failed') {
        const [row] = await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, p.id)).returning();
        await recordStatus(tx, { entityType: 'payment', entityId: p.id, from: 'initiated', to: 'failed', reason: 'declined by gateway' });
        return { payment: row, notify: null };
      }

      const [row] = await tx.update(payments).set({ status: 'succeeded' }).where(eq(payments.id, p.id)).returning();
      await recordStatus(tx, { entityType: 'payment', entityId: p.id, from: 'initiated', to: 'succeeded' });

      if (p.bookingId) {
        const b = await lockBooking(tx, p.bookingId);
        if (b.status !== 'pending_payment') {
          // Paid after the hold expired and the booking was cancelled: refund at once.
          await this.refundInTx(tx, row, row.amountHalalas, 'paid after booking expired', null);
          return { payment: row, notify: null };
        }
        await convertHoldToBooked(tx, b);
        const paid = await transitionBooking(tx, b, 'paid', {
          actorId: b.pilgrimId,
          set: { holdExpiresAt: null, acceptBy: new Date(Date.now() + PROVIDER_ACCEPT_MINUTES * 60_000) },
        });
        const [slot] = b.slotId
          ? await tx.select({ startsAt: availabilitySlots.startsAt }).from(availabilitySlots).where(eq(availabilitySlots.id, b.slotId))
          : [];
        const slotStart = slot?.startsAt;
        const [info] = await tx
          .select({ title: services.title, providerId: services.providerId, ownerId: providers.ownerId })
          .from(services)
          .innerJoin(providers, eq(providers.id, services.providerId))
          .where(eq(services.id, b.serviceId));
        return {
          payment: row,
          notify: async () => {
            this.realtime.emit(`provider:${info.providerId}`, 'booking.updated', { id: paid.id, status: paid.status });
            this.realtime.emit(`user:${paid.pilgrimId}`, 'booking.updated', { id: paid.id, status: paid.status });
            await this.notifications.toUsers(
              [info.ownerId],
              'booking.paid_provider',
              { service: info.title, when: slotStart ?? '' },
              { data: { bookingId: paid.id } },
            );
          },
        };
      }

      const o = await lockOrder(tx, p.orderId!);
      if (o.status !== 'pending_payment') return { payment: row, notify: null };
      try {
        await tx.transaction(async (inner) => reserveStock(inner, o.id));
      } catch (err) {
        await transitionOrder(tx, o, 'cancelled', { reason: 'out of stock at payment' });
        const cancelled = { ...o, status: 'cancelled' as const };
        await this.refundInTx(tx, row, row.amountHalalas, 'out of stock', null);
        await transitionOrder(tx, cancelled, 'refunded', { reason: 'out of stock at payment' });
        this.log.warn(`order ${o.id} refunded: ${(err as Error).message}`);
        return { payment: row, notify: null };
      }
      const paid = await transitionOrder(tx, o, 'paid', { actorId: o.pilgrimId });
      const [shop] = await tx.select({ ownerId: providers.ownerId }).from(providers).where(eq(providers.id, o.shopId));
      const items = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, o.id));
      return {
        payment: row,
        notify: async () => {
          this.realtime.emit(`provider:${o.shopId}`, 'order.updated', { id: paid.id, status: paid.status });
          this.realtime.emit(`user:${o.pilgrimId}`, 'order.updated', { id: paid.id, status: paid.status });
          await this.notifications.toUsers([shop.ownerId], 'order.paid_shop', { ref: paid.id.slice(0, 8).toUpperCase(), items: items.length }, {
            data: { orderId: paid.id },
          });
        },
      };
    });
    await result.notify?.();
    return this.checkoutView(result.payment);
  }

  /**
   * Refund part or all of what was paid for a booking or order, back to the original
   * method (guide: Refunds). Call inside the caller's transaction.
   */
  async refund(tx: Tx, target: Target, amountHalalas: number, reason: string, actorId: string | null): Promise<number> {
    const where = target.bookingId ? eq(payments.bookingId, target.bookingId) : eq(payments.orderId, target.orderId!);
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(where, inArray(payments.status, ['succeeded', 'partially_refunded'])))
      .orderBy(desc(payments.createdAt))
      .limit(1)
      .for('update');
    if (!p) return 0; // nothing was paid
    return this.refundInTx(tx, p, amountHalalas, reason, actorId);
  }

  private async refundInTx(tx: Tx, p: typeof payments.$inferSelect, amountHalalas: number, reason: string, actorId: string | null) {
    const refundable = p.amountHalalas - p.refundedHalalas;
    const amount = Math.min(Math.max(0, Math.trunc(amountHalalas)), refundable);
    if (amount === 0) return 0;
    const res = await this.gateway.refund({ gatewayRef: p.gatewayRef!, amountHalalas: amount });
    if (!res.ok) throw new AppError(HttpStatus.BAD_GATEWAY, 'payment.refund_failed', 'The gateway refused the refund');
    const refunded = p.refundedHalalas + amount;
    const status = refunded >= p.amountHalalas ? 'refunded' : 'partially_refunded';
    await tx.update(payments).set({ refundedHalalas: refunded, status }).where(eq(payments.id, p.id));
    await recordStatus(tx, { entityType: 'payment', entityId: p.id, from: p.status, to: status, actorId, reason: `${reason} (${amount} halalas)` });
    const pilgrimId = p.bookingId
      ? (await tx.select({ id: bookings.pilgrimId }).from(bookings).where(eq(bookings.id, p.bookingId)))[0]?.id
      : (await tx.select({ id: orders.pilgrimId }).from(orders).where(eq(orders.id, p.orderId!)))[0]?.id;
    if (pilgrimId) {
      await this.notifications.toUsers([pilgrimId], 'booking.refunded', { amount: formatHalalas(amount) }, { tx, data: { paymentId: p.id } });
    }
    return amount;
  }

  /** Payment history for a booking or order (owner, its provider, or admin). */
  async forTarget(user: AuthUser, target: Target) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(target.bookingId ? eq(payments.bookingId, target.bookingId) : eq(payments.orderId, target.orderId!))
      .orderBy(desc(payments.createdAt));
    void user; // visibility is checked by the bookings/orders services before calling this
    return rows.map(({ gatewayRef: _ref, ...p }) => p);
  }

  /** Admin view: recent payments with filters. */
  async adminList(q: { limit: number; offset: number; status?: string }) {
    return this.db
      .select()
      .from(payments)
      .where(q.status ? eq(payments.status, q.status as typeof payments.$inferSelect.status) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(q.limit)
      .offset(q.offset);
  }

  /** For the bookings service: is there any captured money on this target? */
  async capturedHalalas(tx: Tx, target: Target): Promise<number> {
    const rows = await tx
      .select({ amount: payments.amountHalalas, refunded: payments.refundedHalalas })
      .from(payments)
      .where(
        and(
          target.bookingId ? eq(payments.bookingId, target.bookingId) : eq(payments.orderId, target.orderId!),
          or(eq(payments.status, 'succeeded'), eq(payments.status, 'partially_refunded')),
        ),
      );
    return rows.reduce((s, r) => s + r.amount - r.refunded, 0);
  }
}
