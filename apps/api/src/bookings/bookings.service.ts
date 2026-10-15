import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, lte, ne, sql, type SQL } from 'drizzle-orm';
import {
  bookingTotal,
  PAYMENT_HOLD_MINUTES,
  refundFor,
  slotUnits,
  type BookingStatus,
  type CancellationPolicy,
  type Language,
  type PriceModel,
} from '@rafeeq/shared';
import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import type { Database, Tx } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import {
  availabilitySlots,
  bags,
  bookings,
  payments,
  providers,
  services,
  staffMembers,
  statusEvents,
  users,
  type GeoPoint,
} from '../db/schema.js';
import { ownsProvider, worksFor } from '../common/access.js';
import { audit } from '../common/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { toPage, type PageQuery } from '../common/pagination.js';
import { pick } from '../common/translate.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { lockBooking, releaseCapacity, transitionBooking, type BookingRow } from './lifecycle.js';

export type CreateBookingInput = {
  serviceId: string;
  slotId: string;
  quantity?: number;
  options?: string[];
  meetingPoint?: string;
  pickup?: GeoPoint;
  dropoff?: GeoPoint;
  notes?: string;
};

const UPCOMING: BookingStatus[] = ['pending_payment', 'paid', 'accepted', 'in_progress', 'disputed'];

@Injectable()
export class BookingsService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  // ───────────── reading ─────────────

  private async context(b: BookingRow) {
    const [row] = await this.db
      .select({ service: services, provider: providers })
      .from(services)
      .innerJoin(providers, eq(providers.id, services.providerId))
      .where(eq(services.id, b.serviceId));
    return row;
  }

  private canSee(user: AuthUser, b: BookingRow, providerId: string): boolean {
    if (isAdmin(user)) return true;
    if (b.pilgrimId === user.id) return true;
    if (ownsProvider(user, providerId)) return true;
    if (worksFor(user, providerId) && user.staff.some((s) => s.id === b.assignedStaffId)) return true;
    return false;
  }

  async get(user: AuthUser, id: string, lang?: Language) {
    const [b] = await this.db.select().from(bookings).where(eq(bookings.id, id));
    if (!b) throw notFound('booking');
    const ctx = await this.context(b);
    if (!this.canSee(user, b, ctx.provider.id)) throw notFound('booking'); // don't reveal it exists
    return this.view(b, ctx, lang ?? user.language, user);
  }

  private async view(b: BookingRow, ctx: { service: typeof services.$inferSelect; provider: typeof providers.$inferSelect }, lang: Language, user: AuthUser) {
    const [slot] = b.slotId ? await this.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, b.slotId)) : [];
    const [staff] = b.assignedStaffId
      ? await this.db
          .select({ id: staffMembers.id, name: users.name, phone: users.phone, staffRole: staffMembers.staffRole, vehicle: staffMembers.vehicle })
          .from(staffMembers)
          .innerJoin(users, eq(users.id, staffMembers.userId))
          .where(eq(staffMembers.id, b.assignedStaffId))
      : [];
    const [pilgrim] = await this.db
      .select({ name: users.name, phone: users.phone, language: users.language })
      .from(users)
      .where(eq(users.id, b.pilgrimId));
    const history = await this.db
      .select({ from: statusEvents.fromStatus, to: statusEvents.toStatus, at: statusEvents.at, reason: statusEvents.reason })
      .from(statusEvents)
      .where(and(eq(statusEvents.entityType, 'booking'), eq(statusEvents.entityId, b.id)))
      .orderBy(asc(statusEvents.at));
    const pays = await this.db
      .select({ id: payments.id, status: payments.status, method: payments.method, amountHalalas: payments.amountHalalas, refundedHalalas: payments.refundedHalalas, createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.bookingId, b.id))
      .orderBy(desc(payments.createdAt));
    const bagRows = await this.db.select().from(bags).where(eq(bags.bookingId, b.id));
    const isPilgrim = b.pilgrimId === user.id;
    const showContact = !isPilgrim || ['accepted', 'in_progress'].includes(b.status);
    const cancelPreview = isPilgrim && slot ? this.cancelPreview(b, ctx.service.cancellationPolicy as CancellationPolicy, slot.startsAt) : null;

    return {
      id: b.id,
      status: b.status,
      service: { id: ctx.service.id, title: pick(ctx.service.title, lang), category: ctx.service.category, priceModel: ctx.service.priceModel, cancellationPolicy: ctx.service.cancellationPolicy },
      provider: { id: ctx.provider.id, name: pick(ctx.provider.name, lang), phone: showContact ? ctx.provider.phone : null },
      slot: slot ? { id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() } : null,
      quantity: b.quantity,
      options: b.options ?? [],
      totalHalalas: b.totalHalalas,
      holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
      acceptBy: b.acceptBy?.toISOString() ?? null,
      meetingPoint: b.meetingPoint,
      pickup: b.pickup,
      dropoff: b.dropoff,
      needs: b.needs,
      notes: b.notes,
      pilgrim: isPilgrim ? null : { name: pilgrim.name, phone: ['accepted', 'in_progress'].includes(b.status) || isAdmin(user) ? pilgrim.phone : null, language: pilgrim.language },
      staff: staff ? { id: staff.id, name: staff.name, staffRole: staff.staffRole, vehicle: staff.vehicle, phone: showContact ? staff.phone : null } : null,
      liveLocation: ['accepted', 'in_progress'].includes(b.status) ? b.liveLocation : null,
      payments: pays,
      bags: bagRows.map((g) => ({ id: g.id, tagCode: g.tagCode, label: g.label, status: g.status })),
      cancel: cancelPreview,
      history,
      createdAt: b.createdAt.toISOString(),
    };
  }

  private cancelPreview(b: BookingRow, policy: CancellationPolicy, startsAt: Date) {
    if (b.status === 'pending_payment') return { allowed: true, refundHalalas: 0 };
    if (!['paid', 'accepted'].includes(b.status)) return { allowed: false, refundHalalas: 0 };
    const hours = (startsAt.getTime() - Date.now()) / 3600_000;
    return { allowed: hours > 0, refundHalalas: refundFor(policy, hours, b.totalHalalas) };
  }

  async listMine(user: AuthUser, q: PageQuery & { scope?: 'upcoming' | 'past' | 'all' }) {
    const where: SQL[] = [eq(bookings.pilgrimId, user.id)];
    if (q.scope === 'upcoming') where.push(inArray(bookings.status, UPCOMING));
    if (q.scope === 'past') where.push(sql`${bookings.status} not in ('pending_payment','paid','accepted','in_progress','disputed')`);
    const rows = await this.db
      .select({ b: bookings, title: services.title, category: services.category, providerName: providers.name, startsAt: availabilitySlots.startsAt })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(providers, eq(providers.id, services.providerId))
      .leftJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(and(...where))
      .orderBy(q.scope === 'past' ? desc(availabilitySlots.startsAt) : asc(availabilitySlots.startsAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({
        id: r.b.id,
        status: r.b.status,
        title: pick(r.title, user.language),
        category: r.category,
        provider: pick(r.providerName, user.language),
        startsAt: r.startsAt?.toISOString() ?? null,
        totalHalalas: r.b.totalHalalas,
        quantity: r.b.quantity,
      })),
      q,
    );
  }

  async listForProvider(
    user: AuthUser,
    q: PageQuery & { providerId: string; status?: BookingStatus; from?: Date; to?: Date; lang?: Language },
  ) {
    const lang = q.lang ?? user.language;
    if (!ownsProvider(user, q.providerId) && !isAdmin(user)) throw forbidden('provider.not_yours', 'Not your provider account');
    const where: (SQL | undefined)[] = [eq(services.providerId, q.providerId), ne(bookings.status, 'pending_payment')];
    if (q.status) where.push(eq(bookings.status, q.status));
    if (q.from) where.push(gte(availabilitySlots.startsAt, q.from));
    if (q.to) where.push(lt(availabilitySlots.startsAt, q.to));
    const rows = await this.db
      .select({
        b: bookings,
        title: services.title,
        category: services.category,
        startsAt: availabilitySlots.startsAt,
        pilgrimName: users.name,
        pilgrimLanguage: users.language,
      })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(users, eq(users.id, bookings.pilgrimId))
      .leftJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(and(...where))
      .orderBy(asc(availabilitySlots.startsAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({
        id: r.b.id,
        status: r.b.status,
        title: pick(r.title, lang),
        category: r.category,
        startsAt: r.startsAt?.toISOString() ?? null,
        quantity: r.b.quantity,
        totalHalalas: r.b.totalHalalas,
        acceptBy: r.b.acceptBy?.toISOString() ?? null,
        assignedStaffId: r.b.assignedStaffId,
        needs: r.b.needs,
        pilgrim: { name: r.pilgrimName, language: r.pilgrimLanguage },
      })),
      q,
    );
  }

  /** Staff mode: jobs assigned to me for a Saudi date (default today). */
  async staffJobs(user: AuthUser, date?: string) {
    const staffIds = user.staff.map((s) => s.id);
    if (!staffIds.length) return [];
    const day = date ?? new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const [y, m, d] = day.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, d) - 3 * 3600_000);
    const to = new Date(from.getTime() + 24 * 3600_000);
    const rows = await this.db
      .select({ b: bookings, title: services.title, category: services.category, startsAt: availabilitySlots.startsAt, endsAt: availabilitySlots.endsAt, pilgrimName: users.name, pilgrimPhone: users.phone, pilgrimLanguage: users.language })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(users, eq(users.id, bookings.pilgrimId))
      .leftJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(
        and(
          inArray(bookings.assignedStaffId, staffIds),
          inArray(bookings.status, ['accepted', 'in_progress', 'completed']),
          // Jobs that start today, plus long jobs (luggage, storage) still running.
          sql`(${availabilitySlots.startsAt} >= ${from} and ${availabilitySlots.startsAt} < ${to}) or ${bookings.status} = 'in_progress'`,
        ),
      )
      .orderBy(asc(availabilitySlots.startsAt));
    return rows.map((r) => ({
      id: r.b.id,
      status: r.b.status,
      title: pick(r.title, user.language),
      category: r.category,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      quantity: r.b.quantity,
      meetingPoint: r.b.meetingPoint,
      pickup: r.b.pickup,
      dropoff: r.b.dropoff,
      needs: r.b.needs,
      notes: r.b.notes,
      pilgrim: { name: r.pilgrimName, phone: r.pilgrimPhone, language: r.pilgrimLanguage },
    }));
  }

  async adminList(q: PageQuery & { status?: BookingStatus; providerId?: string; lang?: Language }) {
    const lang = q.lang ?? 'en';
    const where: (SQL | undefined)[] = [];
    if (q.status) where.push(eq(bookings.status, q.status));
    if (q.providerId) where.push(eq(services.providerId, q.providerId));
    const rows = await this.db
      .select({ b: bookings, title: services.title, providerName: providers.name, pilgrimName: users.name, startsAt: availabilitySlots.startsAt })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(providers, eq(providers.id, services.providerId))
      .innerJoin(users, eq(users.id, bookings.pilgrimId))
      .leftJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({
        id: r.b.id,
        status: r.b.status,
        title: pick(r.title, lang),
        provider: pick(r.providerName, lang),
        pilgrim: r.pilgrimName,
        startsAt: r.startsAt?.toISOString() ?? null,
        totalHalalas: r.b.totalHalalas,
        createdAt: r.b.createdAt.toISOString(),
        isSample: r.b.isSample,
      })),
      q,
    );
  }

  // ───────────── pilgrim actions ─────────────

  async create(user: AuthUser, input: CreateBookingInput) {
    if (user.role !== 'pilgrim') throw forbidden('booking.pilgrims_only', 'Only pilgrim accounts can book');
    const quantity = input.quantity ?? 1;

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ service: services, providerStatus: providers.status })
        .from(services)
        .innerJoin(providers, eq(providers.id, services.providerId))
        .where(eq(services.id, input.serviceId));
      if (!row || !row.service.active || row.providerStatus !== 'approved') throw notFound('service');
      const s = row.service;

      const [slot] = await tx.select().from(availabilitySlots).where(eq(availabilitySlots.id, input.slotId)).for('update');
      if (!slot || slot.serviceId !== s.id) throw badRequest('booking.invalid_slot', 'This time is not offered for this service');
      if (slot.blocked || slot.startsAt <= new Date()) throw conflict('booking.slot_unavailable', 'This time is no longer available');

      const optionPrices = (input.options ?? []).map((key) => {
        const opt = (s.options ?? []).find((o) => o.key === key);
        if (!opt) throw badRequest('booking.invalid_option', `Unknown option ${key}`);
        return opt.priceHalalas;
      });
      let total: number;
      let units: number;
      try {
        total = bookingTotal(s.priceModel as PriceModel, s.priceHalalas, quantity, optionPrices);
        units = slotUnits(s.priceModel as PriceModel, quantity);
      } catch (e) {
        throw badRequest('booking.invalid_quantity', (e as Error).message);
      }
      const remaining = slot.capacity - slot.booked - slot.held;
      if (units > remaining) throw conflict('booking.not_enough_capacity', 'Not enough places left at this time', { remaining });

      const [profile] = await tx.select({ needs: users.accessibilityNeeds }).from(users).where(eq(users.id, user.id));
      await tx
        .update(availabilitySlots)
        .set({ held: sql`${availabilitySlots.held} + ${units}` })
        .where(eq(availabilitySlots.id, slot.id));
      const [b] = await tx
        .insert(bookings)
        .values({
          pilgrimId: user.id,
          serviceId: s.id,
          slotId: slot.id,
          quantity,
          options: input.options ?? [],
          totalHalalas: total,
          status: 'pending_payment',
          holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000),
          meetingPoint: input.meetingPoint,
          pickup: input.pickup,
          dropoff: input.dropoff,
          needs: profile?.needs ?? [],
          notes: input.notes,
        })
        .returning();
      await tx.insert(statusEvents).values({ entityType: 'booking', entityId: b.id, fromStatus: null, toStatus: 'pending_payment', actorId: user.id });
      return b;
    });
    return this.get(user, created.id);
  }

  async cancel(user: AuthUser, id: string, reason?: string) {
    const out = await this.db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (b.pilgrimId !== user.id) throw notFound('booking');
      if (b.status === 'pending_payment') {
        await releaseCapacity(tx, b, 'held');
        await transitionBooking(tx, b, 'cancelled', { actorId: user.id, reason: reason ?? 'cancelled before payment', set: { holdExpiresAt: null } });
        return { refundHalalas: 0 };
      }
      if (!['paid', 'accepted'].includes(b.status)) throw conflict('booking.cannot_cancel', 'This booking can no longer be cancelled');
      const [s] = await tx.select().from(services).where(eq(services.id, b.serviceId));
      const [slot] = await tx.select().from(availabilitySlots).where(eq(availabilitySlots.id, b.slotId!));
      const hours = (slot.startsAt.getTime() - Date.now()) / 3600_000;
      if (hours <= 0) throw conflict('booking.already_started', 'The booking time has passed; open a dispute instead');
      const refund = refundFor(s.cancellationPolicy as CancellationPolicy, hours, b.totalHalalas);
      await releaseCapacity(tx, b, 'booked');
      const cancelled = await transitionBooking(tx, b, 'cancelled', { actorId: user.id, reason: reason ?? 'cancelled by pilgrim' });
      const refunded = await this.payments.refund(tx, { bookingId: b.id }, refund, 'pilgrim cancellation', user.id);
      if (refunded > 0) await transitionBooking(tx, cancelled, 'refunded', { actorId: user.id, reason: `refund ${refunded} halalas` });
      return { refundHalalas: refunded, providerId: s.providerId };
    });
    if (out.providerId) this.realtime.emit(`provider:${out.providerId}`, 'booking.updated', { id, status: 'cancelled' });
    return { ...(await this.get(user, id)), refundHalalas: out.refundHalalas };
  }

  async dispute(user: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (b.pilgrimId !== user.id) throw notFound('booking');
      if (b.status === 'completed') {
        const [done] = await tx
          .select({ at: statusEvents.at })
          .from(statusEvents)
          .where(and(eq(statusEvents.entityId, b.id), eq(statusEvents.toStatus, 'completed')))
          .orderBy(desc(statusEvents.at))
          .limit(1);
        if (done && Date.now() - done.at.getTime() > 7 * 24 * 3600_000) {
          throw conflict('booking.dispute_window_closed', 'Disputes can be opened up to 7 days after completion');
        }
      }
      await transitionBooking(tx, b, 'disputed', { actorId: user.id, reason });
    });
    this.realtime.emit('admin', 'booking.disputed', { id });
    return this.get(user, id);
  }

  /** After a decline or timeout: similar services from other providers around the same time. */
  async alternatives(user: AuthUser, id: string) {
    const [b] = await this.db.select().from(bookings).where(eq(bookings.id, id));
    if (!b || b.pilgrimId !== user.id) throw notFound('booking');
    const [s] = await this.db.select().from(services).where(eq(services.id, b.serviceId));
    const [slot] = b.slotId ? await this.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, b.slotId)) : [];
    const around = slot?.startsAt ?? new Date();
    const from = new Date(Math.max(Date.now(), around.getTime() - 3 * 3600_000));
    const to = new Date(around.getTime() + 3 * 3600_000);
    const rows = await this.db
      .select({ service: services, providerName: providers.name, slotId: availabilitySlots.id, startsAt: availabilitySlots.startsAt, remaining: sql<number>`${availabilitySlots.capacity} - ${availabilitySlots.booked} - ${availabilitySlots.held}` })
      .from(availabilitySlots)
      .innerJoin(services, eq(services.id, availabilitySlots.serviceId))
      .innerJoin(providers, eq(providers.id, services.providerId))
      .where(
        and(
          eq(services.category, s.category),
          eq(services.serviceArea, s.serviceArea),
          eq(services.active, true),
          eq(providers.status, 'approved'),
          ne(services.providerId, s.providerId),
          gte(availabilitySlots.startsAt, from),
          lte(availabilitySlots.startsAt, to),
          eq(availabilitySlots.blocked, false),
          sql`${availabilitySlots.capacity} - ${availabilitySlots.booked} - ${availabilitySlots.held} > 0`,
        ),
      )
      .orderBy(asc(availabilitySlots.startsAt))
      .limit(10);
    return rows.map((r) => ({
      serviceId: r.service.id,
      title: pick(r.service.title, user.language),
      provider: pick(r.providerName, user.language),
      priceHalalas: r.service.priceHalalas,
      priceModel: r.service.priceModel,
      slotId: r.slotId,
      startsAt: r.startsAt.toISOString(),
      remaining: Number(r.remaining),
    }));
  }

  // ───────────── provider and staff actions ─────────────

  private async lockForProvider(tx: Tx, user: AuthUser, id: string, allowStaff: boolean) {
    const b = await lockBooking(tx, id);
    const [s] = await tx.select().from(services).where(eq(services.id, b.serviceId));
    const owner = ownsProvider(user, s.providerId);
    const assignedStaff = allowStaff && user.staff.some((m) => m.id === b.assignedStaffId);
    if (!owner && !assignedStaff && !isAdmin(user)) throw notFound('booking');
    return { b, s };
  }

  private async notifyPilgrim(b: BookingRow, template: 'booking.accepted' | 'booking.declined' | 'booking.started' | 'booking.completed' | 'booking.staff_assigned', params: Record<string, string | Record<string, string>>) {
    this.realtime.emit(`user:${b.pilgrimId}`, 'booking.updated', { id: b.id, status: b.status });
    await this.notifications.toUsers([b.pilgrimId], template, params as never, { data: { bookingId: b.id } });
  }

  async accept(user: AuthUser, id: string) {
    const { b, provider, title } = await this.db.transaction(async (tx) => {
      const { b, s } = await this.lockForProvider(tx, user, id, false);
      const [p] = await tx.select().from(providers).where(eq(providers.id, s.providerId));
      const row = await transitionBooking(tx, b, 'accepted', { actorId: user.id, set: { acceptBy: null } });
      return { b: row, provider: p.name, title: s.title };
    });
    await this.notifyPilgrim(b, 'booking.accepted', { provider, service: title });
    return this.get(user, id);
  }

  /** Declining refunds the pilgrim in full and offers alternatives in the app. */
  async decline(user: AuthUser | null, id: string, reason: string) {
    const actorId = user?.id ?? null;
    const { b, provider } = await this.db.transaction(async (tx) => {
      const { b, s } = user ? await this.lockForProvider(tx, user, id, false) : await this.lockAny(tx, id);
      const [p] = await tx.select().from(providers).where(eq(providers.id, s.providerId));
      await releaseCapacity(tx, b, 'booked');
      const declined = await transitionBooking(tx, b, 'declined', { actorId, reason, set: { acceptBy: null } });
      const refunded = await this.payments.refund(tx, { bookingId: b.id }, b.totalHalalas, `declined: ${reason}`, actorId);
      const final = refunded > 0 ? await transitionBooking(tx, declined, 'refunded', { actorId, reason: `refund ${refunded} halalas` }) : declined;
      return { b: final, provider: p.name };
    });
    await this.notifyPilgrim(b, 'booking.declined', { provider });
    return b;
  }

  private async lockAny(tx: Tx, id: string) {
    const b = await lockBooking(tx, id);
    const [s] = await tx.select().from(services).where(eq(services.id, b.serviceId));
    return { b, s };
  }

  /** Provider cancels after accepting: always a full refund. */
  async providerCancel(user: AuthUser, id: string, reason: string) {
    const b = await this.db.transaction(async (tx) => {
      const { b } = await this.lockForProvider(tx, user, id, false);
      if (b.status !== 'accepted') throw conflict('booking.cannot_cancel', 'Only accepted bookings can be cancelled by the provider');
      await releaseCapacity(tx, b, 'booked');
      const cancelled = await transitionBooking(tx, b, 'cancelled', { actorId: user.id, reason: `provider: ${reason}` });
      const refunded = await this.payments.refund(tx, { bookingId: b.id }, b.totalHalalas, 'provider cancelled', user.id);
      return refunded > 0 ? transitionBooking(tx, cancelled, 'refunded', { actorId: user.id }) : cancelled;
    });
    this.realtime.emit(`user:${b.pilgrimId}`, 'booking.updated', { id: b.id, status: b.status });
    return this.get(user, id);
  }

  async assign(user: AuthUser, id: string, staffId: string) {
    const { b, staffName, title } = await this.db.transaction(async (tx) => {
      const { b, s } = await this.lockForProvider(tx, user, id, false);
      if (!['accepted', 'in_progress'].includes(b.status)) throw conflict('booking.cannot_assign', 'Accept the booking before assigning staff');
      const [m] = await tx
        .select({ id: staffMembers.id, active: staffMembers.active, providerId: staffMembers.providerId, name: users.name })
        .from(staffMembers)
        .innerJoin(users, eq(users.id, staffMembers.userId))
        .where(eq(staffMembers.id, staffId));
      if (!m || m.providerId !== s.providerId || !m.active) throw badRequest('booking.invalid_staff', 'Choose one of your active staff');
      const [row] = await tx.update(bookings).set({ assignedStaffId: staffId }).where(eq(bookings.id, id)).returning();
      return { b: row, staffName: m.name.split(' (')[0], title: s.title };
    });
    await this.notifyPilgrim(b, 'booking.staff_assigned', { staff: staffName, service: title });
    return this.get(user, id);
  }

  async start(user: AuthUser, id: string) {
    const { b, title } = await this.db.transaction(async (tx) => {
      const { b, s } = await this.lockForProvider(tx, user, id, true);
      return { b: await transitionBooking(tx, b, 'in_progress', { actorId: user.id }), title: s.title };
    });
    await this.notifyPilgrim(b, 'booking.started', { service: title });
    return this.get(user, id);
  }

  async complete(user: AuthUser, id: string) {
    const { b, title } = await this.db.transaction(async (tx) => {
      const { b, s } = await this.lockForProvider(tx, user, id, true);
      return { b: await transitionBooking(tx, b, 'completed', { actorId: user.id, set: { liveLocation: null } }), title: s.title };
    });
    await this.notifyPilgrim(b, 'booking.completed', { service: title });
    return this.get(user, id);
  }

  /** Staff share their position while on the way or during the job (live driver tracking). */
  async shareLocation(user: AuthUser, id: string, point: { lat: number; lng: number }) {
    const [b] = await this.db.select().from(bookings).where(eq(bookings.id, id));
    if (!b || !user.staff.some((m) => m.id === b.assignedStaffId)) throw notFound('booking');
    if (!['accepted', 'in_progress'].includes(b.status)) throw conflict('booking.not_active', 'Location is shared only during the job');
    const live = { lat: point.lat, lng: point.lng, at: new Date().toISOString() };
    await this.db.update(bookings).set({ liveLocation: live }).where(eq(bookings.id, id));
    this.realtime.emit(`user:${b.pilgrimId}`, 'staff.location', { bookingId: id, ...live });
    return live;
  }

  // ───────────── admin ─────────────

  async resolveDispute(admin: AuthUser, id: string, outcome: 'complete' | 'refund', amountHalalas?: number, note?: string) {
    const b = await this.db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (b.status !== 'disputed') throw conflict('booking.not_disputed', 'This booking is not in dispute');
      await audit(tx, admin.id, `booking.dispute_${outcome}`, { type: 'booking', id }, { amountHalalas, note });
      if (outcome === 'complete') return transitionBooking(tx, b, 'completed', { actorId: admin.id, reason: note ?? 'dispute resolved for provider' });
      const amount = amountHalalas ?? b.totalHalalas;
      const refunded = await this.payments.refund(tx, { bookingId: b.id }, amount, `dispute: ${note ?? ''}`, admin.id);
      await releaseCapacity(tx, b, 'booked');
      return transitionBooking(tx, b, 'refunded', { actorId: admin.id, reason: `dispute refund ${refunded} halalas` });
    });
    this.realtime.emit(`user:${b.pilgrimId}`, 'booking.updated', { id: b.id, status: b.status });
    return this.get(admin, id);
  }

  /** Admin refund of any paid booking (support cases). Full or partial. */
  async adminRefund(admin: AuthUser, id: string, amountHalalas: number, reason: string) {
    await this.db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (!['paid', 'accepted', 'cancelled', 'declined', 'completed', 'disputed'].includes(b.status)) {
        throw conflict('booking.cannot_refund', `Cannot refund a ${b.status} booking`);
      }
      const refunded = await this.payments.refund(tx, { bookingId: b.id }, amountHalalas, `admin: ${reason}`, admin.id);
      await audit(tx, admin.id, 'booking.refund', { type: 'booking', id }, { amountHalalas: refunded, reason });
      const fullyRefunded = (await this.payments.capturedHalalas(tx, { bookingId: b.id })) === 0;
      if (fullyRefunded && ['cancelled', 'declined', 'disputed', 'paid', 'accepted'].includes(b.status)) {
        let current = b;
        if (b.status === 'paid' || b.status === 'accepted') {
          await releaseCapacity(tx, b, 'booked');
          current = await transitionBooking(tx, b, 'cancelled', { actorId: admin.id, reason: `admin: ${reason}` });
        }
        await transitionBooking(tx, current, 'refunded', { actorId: admin.id, reason: `admin: ${reason}` });
      }
    });
    return this.get(admin, id);
  }

  // ───────────── jobs ─────────────

  /** Release slots held for payments that never finished (runs every minute). */
  async expireHolds(now = new Date()): Promise<number> {
    const expired = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.status, 'pending_payment'), lt(bookings.holdExpiresAt, now)));
    for (const { id } of expired) {
      await this.db.transaction(async (tx) => {
        const b = await lockBooking(tx, id);
        if (b.status !== 'pending_payment') return;
        await releaseCapacity(tx, b, 'held');
        await transitionBooking(tx, b, 'cancelled', { reason: 'payment time ran out', set: { holdExpiresAt: null } });
      });
    }
    return expired.length;
  }

  /** Providers that don't answer in time: decline and refund automatically (runs every minute). */
  async expireUnaccepted(now = new Date()): Promise<number> {
    const late = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.status, 'paid'), lt(bookings.acceptBy, now)));
    for (const { id } of late) await this.decline(null, id, 'provider did not answer in time');
    return late.length;
  }
}
