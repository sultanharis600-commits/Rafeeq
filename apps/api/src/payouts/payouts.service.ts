import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { commissionSplit } from '@rafeeq/shared';
import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import type { Database, Tx } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import {
  bookings,
  orders,
  payments,
  payouts,
  providers,
  reconciliationRuns,
  services,
  statusEvents,
  type PayoutLine,
} from '../db/schema.js';
import { assertProviderManager } from '../common/access.js';
import { audit } from '../common/audit.js';
import { conflict, forbidden, notFound } from '../common/errors.js';
import { recordStatus } from '../common/status.js';
import { transitionBooking } from '../bookings/lifecycle.js';

const DAY = 24 * 3600_000;
const SAUDI = 3 * 3600_000;

/** Monday 00:00 Saudi time at or before `at`, as a UTC Date. */
export function weekStart(at: Date): Date {
  const saudi = new Date(at.getTime() + SAUDI);
  const dow = (saudi.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(saudi.getUTCFullYear(), saudi.getUTCMonth(), saudi.getUTCDate() - dow) - SAUDI);
}

type Candidate = { kind: 'booking' | 'order'; id: string; providerId: string; captured: number; earnedAt: Date };

/**
 * Weekly payouts (guide: Payments). Providers are paid for completed bookings and
 * delivered orders, minus Bidec's commission; cancellation fees the pilgrim was not
 * refunded also go to the provider. Commission is 0 during the free period.
 * In the MVP payouts are calculated, never sent.
 */
@Injectable()
export class PayoutsService {
  private readonly log = new Logger('Payouts');
  constructor(@InjectDb() private readonly db: Database) {}

  private async captured(tx: Tx, kind: 'booking' | 'order', ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const col = kind === 'booking' ? payments.bookingId : payments.orderId;
    const rows = await tx
      .select({ id: col, net: sql<number>`sum(${payments.amountHalalas} - ${payments.refundedHalalas})::int` })
      .from(payments)
      .where(and(inArray(col, ids), inArray(payments.status, ['succeeded', 'partially_refunded', 'refunded'])))
      .groupBy(col);
    return new Map(rows.map((r) => [r.id!, Number(r.net)]));
  }

  /** When did the provider earn it: the completed / delivered / cancelled event. */
  private async earnedAt(tx: Tx, entityType: 'booking' | 'order', ids: string[], statuses: string[]) {
    if (!ids.length) return new Map<string, Date>();
    const rows = await tx
      .select({ id: statusEvents.entityId, at: sql<Date>`max(${statusEvents.at})` })
      .from(statusEvents)
      .where(and(eq(statusEvents.entityType, entityType), inArray(statusEvents.entityId, ids), inArray(statusEvents.toStatus, statuses)))
      .groupBy(statusEvents.entityId);
    return new Map(rows.map((r) => [r.id, new Date(r.at)]));
  }

  private async candidates(tx: Tx, periodEnd: Date): Promise<Candidate[]> {
    const bookingRows = await tx
      .select({ id: bookings.id, status: bookings.status, providerId: services.providerId })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(and(isNull(bookings.payoutId), inArray(bookings.status, ['completed', 'cancelled', 'refunded'])));
    const orderRows = await tx
      .select({ id: orders.id, providerId: orders.shopId })
      .from(orders)
      .where(and(isNull(orders.payoutId), eq(orders.status, 'delivered')));

    const bCaptured = await this.captured(tx, 'booking', bookingRows.map((b) => b.id));
    const oCaptured = await this.captured(tx, 'order', orderRows.map((o) => o.id));
    const bEarned = await this.earnedAt(tx, 'booking', bookingRows.map((b) => b.id), ['completed', 'cancelled', 'refunded']);
    const oEarned = await this.earnedAt(tx, 'order', orderRows.map((o) => o.id), ['delivered']);

    const out: Candidate[] = [];
    for (const b of bookingRows) {
      const captured = bCaptured.get(b.id) ?? 0;
      const at = bEarned.get(b.id);
      // Cancelled/refunded bookings count only if money was kept (a cancellation fee).
      if (!at || at >= periodEnd || (b.status !== 'completed' && captured <= 0)) continue;
      out.push({ kind: 'booking', id: b.id, providerId: b.providerId, captured, earnedAt: at });
    }
    for (const o of orderRows) {
      const at = oEarned.get(o.id);
      if (!at || at >= periodEnd) continue;
      out.push({ kind: 'order', id: o.id, providerId: o.providerId, captured: oCaptured.get(o.id) ?? 0, earnedAt: at });
    }
    return out;
  }

  /**
   * Create payouts for the week ending at `periodEnd` (default: the last Monday 00:00 Saudi time).
   * Safe to run twice: a provider gets one payout per period.
   */
  async run(periodEnd = weekStart(new Date()), actorId: string | null = null) {
    const periodStart = new Date(periodEnd.getTime() - 7 * DAY);
    return this.db.transaction(async (tx) => {
      const all = await this.candidates(tx, periodEnd);
      const byProvider = new Map<string, Candidate[]>();
      for (const c of all) byProvider.set(c.providerId, [...(byProvider.get(c.providerId) ?? []), c]);

      const created: (typeof payouts.$inferSelect)[] = [];
      for (const [providerId, items] of byProvider) {
        const [p] = await tx.select().from(providers).where(eq(providers.id, providerId));
        const [existing] = await tx
          .select({ id: payouts.id })
          .from(payouts)
          .where(and(eq(payouts.providerId, providerId), eq(payouts.periodStart, periodStart)));
        if (existing) continue;

        const lines: PayoutLine[] = items.map((c) => {
          const free = p.commissionFreeUntil && c.earnedAt < p.commissionFreeUntil;
          const { commission } = commissionSplit(c.captured, free ? 0 : p.commissionRateBps);
          return { kind: c.kind, id: c.id, grossHalalas: c.captured, commissionHalalas: commission };
        });
        const gross = lines.reduce((s, l) => s + l.grossHalalas, 0);
        const commission = lines.reduce((s, l) => s + l.commissionHalalas, 0);
        const [payout] = await tx
          .insert(payouts)
          .values({ providerId, periodStart, periodEnd, grossHalalas: gross, commissionHalalas: commission, netHalalas: gross - commission, status: 'calculated', lines })
          .returning();
        await recordStatus(tx, { entityType: 'payout', entityId: payout.id, from: null, to: 'calculated', actorId });

        for (const c of items) {
          if (c.kind === 'order') {
            await tx.update(orders).set({ payoutId: payout.id }).where(eq(orders.id, c.id));
            continue;
          }
          const [b] = await tx.select().from(bookings).where(eq(bookings.id, c.id)).for('update');
          if (b.status === 'completed') {
            await transitionBooking(tx, b, 'paid_out', { actorId, reason: `payout ${payout.id}`, set: { payoutId: payout.id } });
          } else {
            await tx.update(bookings).set({ payoutId: payout.id }).where(eq(bookings.id, c.id));
          }
        }
        created.push(payout);
      }
      if (actorId) await audit(tx, actorId, 'payouts.run', undefined, { periodStart, periodEnd, created: created.length });
      this.log.log(`payout run ${periodStart.toISOString()}–${periodEnd.toISOString()}: ${created.length} payout(s)`);
      return { periodStart, periodEnd, created: created.length, payouts: created };
    });
  }

  async approve(admin: AuthUser, id: string) {
    return this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payouts).where(eq(payouts.id, id)).for('update');
      if (!p) throw notFound('payout');
      if (p.status !== 'calculated') throw conflict('payout.invalid_transition', `Payout is ${p.status}`);
      const [row] = await tx.update(payouts).set({ status: 'approved' }).where(eq(payouts.id, id)).returning();
      await recordStatus(tx, { entityType: 'payout', entityId: id, from: 'calculated', to: 'approved', actorId: admin.id });
      await audit(tx, admin.id, 'payout.approve', { type: 'payout', id }, { netHalalas: p.netHalalas });
      // Sending to the IBAN happens after the MVP, through the gateway's split-payment payouts.
      return row;
    });
  }

  async list(user: AuthUser, providerId?: string) {
    if (!isAdmin(user)) {
      if (!providerId) throw forbidden('provider.required', 'providerId is required');
      assertProviderManager(user, providerId);
    }
    return this.db
      .select({ payout: payouts, providerName: providers.name })
      .from(payouts)
      .innerJoin(providers, eq(providers.id, payouts.providerId))
      .where(providerId ? eq(payouts.providerId, providerId) : undefined)
      .orderBy(desc(payouts.periodStart))
      .limit(100);
  }

  /** Provider dashboard: what is earned but not yet in a payout, and lifetime totals. */
  async earnings(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    const [p] = await this.db.select().from(providers).where(eq(providers.id, providerId));
    if (!p) throw notFound('provider');
    const pending = (await this.candidates(this.db as unknown as Tx, new Date(Date.now() + DAY))).filter((c) => c.providerId === providerId);
    const pendingLines = pending.map((c) => {
      const free = p.commissionFreeUntil && c.earnedAt < p.commissionFreeUntil;
      return { ...c, commission: commissionSplit(c.captured, free ? 0 : p.commissionRateBps).commission };
    });
    const [totals] = await this.db
      .select({
        gross: sql<number>`coalesce(sum(${payouts.grossHalalas}),0)::int`,
        commission: sql<number>`coalesce(sum(${payouts.commissionHalalas}),0)::int`,
        net: sql<number>`coalesce(sum(${payouts.netHalalas}),0)::int`,
      })
      .from(payouts)
      .where(eq(payouts.providerId, providerId));
    return {
      commissionRateBps: p.commissionRateBps,
      commissionFreeUntil: p.commissionFreeUntil,
      pending: {
        items: pendingLines.length,
        grossHalalas: pendingLines.reduce((s, l) => s + l.captured, 0),
        commissionHalalas: pendingLines.reduce((s, l) => s + l.commission, 0),
        netHalalas: pendingLines.reduce((s, l) => s + l.captured - l.commission, 0),
      },
      paidOut: { grossHalalas: totals.gross, commissionHalalas: totals.commission, netHalalas: totals.net },
    };
  }

  // ───────────── reconciliation ─────────────

  /**
   * Daily check (guide: Reconciliation): payments agree with bookings, orders and payouts.
   * In production this also compares against the gateway's settlement report.
   */
  async reconcile(actorId: string | null = null) {
    const mismatches: { kind: string; id: string; problem: string }[] = [];
    const paidStates = ['paid', 'accepted', 'in_progress', 'completed', 'paid_out', 'disputed'];

    const bRows = await this.db
      .select({ id: bookings.id, status: bookings.status, total: bookings.totalHalalas })
      .from(bookings)
      .where(sql`${bookings.status} <> 'pending_payment'`);
    const pRows = await this.db.select().from(payments).where(inArray(payments.status, ['succeeded', 'partially_refunded', 'refunded']));
    const byBooking = new Map<string, typeof pRows>();
    const byOrder = new Map<string, typeof pRows>();
    for (const p of pRows) {
      if (p.bookingId) byBooking.set(p.bookingId, [...(byBooking.get(p.bookingId) ?? []), p]);
      if (p.orderId) byOrder.set(p.orderId, [...(byOrder.get(p.orderId) ?? []), p]);
    }
    for (const b of bRows) {
      const ps = byBooking.get(b.id) ?? [];
      const captured = ps.reduce((s, p) => s + p.amountHalalas, 0);
      const refunded = ps.reduce((s, p) => s + p.refundedHalalas, 0);
      if (paidStates.includes(b.status) && captured !== b.total) mismatches.push({ kind: 'booking', id: b.id, problem: `status ${b.status} but captured ${captured} ≠ total ${b.total}` });
      if (b.status === 'refunded' && refunded === 0) mismatches.push({ kind: 'booking', id: b.id, problem: 'refunded but no refund recorded' });
      if (refunded > captured) mismatches.push({ kind: 'booking', id: b.id, problem: 'refunded more than captured' });
    }
    const oRows = await this.db.select({ id: orders.id, status: orders.status, total: orders.totalHalalas }).from(orders);
    for (const o of oRows) {
      const ps = byOrder.get(o.id) ?? [];
      const captured = ps.reduce((s, p) => s + p.amountHalalas, 0);
      const refunded = ps.reduce((s, p) => s + p.refundedHalalas, 0);
      if (['paid', 'packed', 'out_for_delivery', 'shipped', 'delivered'].includes(o.status) && captured !== o.total) {
        mismatches.push({ kind: 'order', id: o.id, problem: `status ${o.status} but captured ${captured} ≠ total ${o.total}` });
      }
      if (o.status === 'refunded' && refunded === 0) mismatches.push({ kind: 'order', id: o.id, problem: 'refunded but no refund recorded' });
    }
    // Money captured for a booking the pilgrim never got and was not refunded
    for (const [bookingId, ps] of byBooking) {
      const b = bRows.find((x) => x.id === bookingId);
      const net = ps.reduce((s, p) => s + p.amountHalalas - p.refundedHalalas, 0);
      if (!b && net > 0) mismatches.push({ kind: 'payment', id: ps[0].id, problem: 'captured for a booking still waiting for payment' });
    }
    const pays = await this.db.select().from(payouts);
    for (const p of pays) {
      const gross = p.lines.reduce((s, l) => s + l.grossHalalas, 0);
      const comm = p.lines.reduce((s, l) => s + l.commissionHalalas, 0);
      if (gross !== p.grossHalalas || comm !== p.commissionHalalas || p.netHalalas !== gross - comm) {
        mismatches.push({ kind: 'payout', id: p.id, problem: 'lines do not add up' });
      }
    }
    const [run] = await this.db
      .insert(reconciliationRuns)
      .values({ checked: bRows.length + oRows.length + pays.length, mismatches })
      .returning();
    if (actorId) await audit(this.db, actorId, 'reconciliation.run', { type: 'reconciliation_run', id: run.id }, { mismatches: mismatches.length });
    if (mismatches.length) this.log.warn(`reconciliation found ${mismatches.length} mismatch(es)`);
    return run;
  }

  async reconciliationRuns() {
    return this.db.select().from(reconciliationRuns).orderBy(desc(reconciliationRuns.runAt)).limit(30);
  }
}
