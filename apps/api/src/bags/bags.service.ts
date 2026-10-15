import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, lt, max, sql } from 'drizzle-orm';
import { BAG_HANDOVER_POINTS, TAG_ALPHABET, TAG_CODE, type BagHandoverPoint, type BagStatus } from '@rafeeq/shared';
import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import type { Database, Tx } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { bags, bagScans, bookings, lostBagCases, providers, services, staffMembers, users } from '../db/schema.js';
import { assertProviderManager, ownsProvider } from '../common/access.js';
import { audit } from '../common/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { recordStatus } from '../common/status.js';
import { lockBooking, transitionBooking } from '../bookings/lifecycle.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export type ScanInput = {
  tagCode: string;
  placeLabel: BagHandoverPoint;
  placeId?: string;
  scannedAt: Date;
  clientId?: string;
  bookingId?: string; // first scan links a pre-printed tag to the booking
  label?: string;
};

type ScanResult = { tagCode: string; clientId?: string; ok: boolean; scanId?: string; duplicate?: boolean; error?: string };

/**
 * Baggage tracking (guide: Baggage tracking). Every handover is scanned; scans are
 * append-only; a missed expected scan opens a lost-bag case.
 */
@Injectable()
export class BagsService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  // ───────────── tags ─────────────

  /** Pre-print tag codes (admin panel prints them as QR stickers). Codes hold no personal data. */
  async generateTags(admin: AuthUser, count: number) {
    const codes = new Set<string>();
    while (codes.size < count) {
      let c = 'RFQ-';
      for (let i = 0; i < 6; i++) c += TAG_ALPHABET[randomInt(TAG_ALPHABET.length)];
      codes.add(c);
    }
    const existing = await this.db.select({ tagCode: bags.tagCode }).from(bags).where(inArray(bags.tagCode, [...codes]));
    for (const e of existing) codes.delete(e.tagCode);
    const rows = await this.db
      .insert(bags)
      .values([...codes].map((tagCode) => ({ tagCode, status: 'tagged' as const })))
      .returning({ tagCode: bags.tagCode });
    await audit(this.db, admin.id, 'bag_tags.generate', undefined, { count: rows.length });
    return rows.map((r) => r.tagCode);
  }

  // ───────────── scanning ─────────────

  private async staffProviderForBooking(tx: Tx, user: AuthUser, bookingId: string) {
    const [row] = await tx
      .select({ providerId: services.providerId, category: services.category, status: bookings.status, pilgrimId: bookings.pilgrimId, quantity: bookings.quantity })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(eq(bookings.id, bookingId));
    if (!row) throw notFound('booking');
    const member = user.staff.find((s) => s.providerId === row.providerId);
    if (!member && !ownsProvider(user, row.providerId)) throw forbidden('bag.not_your_booking', 'This bag belongs to another provider');
    if (row.category !== 'luggage') throw badRequest('bag.not_luggage', 'Bags can only be tagged on luggage bookings');
    if (!['accepted', 'in_progress', 'completed'].includes(row.status)) throw conflict('bag.booking_not_active', 'Accept the booking before tagging bags');
    return { ...row, staffId: member?.id ?? null };
  }

  /**
   * Record a batch of scans from the staff app. Scans made offline sync later and keep
   * the time they happened. A scan with a clientId already stored is ignored, so
   * retrying a sync is safe. Each scan succeeds or fails on its own.
   */
  async scanBatch(user: AuthUser, scans: ScanInput[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    for (const s of scans) {
      try {
        results.push(await this.scanOne(user, s));
      } catch (e) {
        const err = e as { response?: { code?: string }; message: string };
        results.push({ tagCode: s.tagCode, clientId: s.clientId, ok: false, error: err.response?.code ?? err.message });
      }
    }
    return results;
  }

  private async scanOne(user: AuthUser, s: ScanInput): Promise<ScanResult> {
    if (!TAG_CODE.test(s.tagCode)) throw badRequest('bag.invalid_tag', 'Not a Rafeeq bag tag');
    if (!(s.placeLabel in BAG_HANDOVER_POINTS)) throw badRequest('bag.invalid_place', 'Unknown handover point');
    if (s.scannedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('bag.future_scan', 'Scan time is in the future');

    const notify = await this.db.transaction(async (tx) => {
      if (s.clientId) {
        const [dup] = await tx.select({ id: bagScans.id }).from(bagScans).where(eq(bagScans.clientId, s.clientId));
        if (dup) return { result: { tagCode: s.tagCode, clientId: s.clientId, ok: true, scanId: dup.id, duplicate: true } };
      }
      const [bag] = await tx.select().from(bags).where(eq(bags.tagCode, s.tagCode)).for('update');
      if (!bag) throw notFound('bag');

      let bookingId = bag.bookingId;
      if (!bookingId) {
        if (!s.bookingId) throw badRequest('bag.not_linked', 'Scan the booking first to link this new tag');
        bookingId = s.bookingId;
      } else if (s.bookingId && s.bookingId !== bookingId) {
        throw conflict('bag.other_booking', 'This tag is already on another booking');
      }
      const ctx = await this.staffProviderForBooking(tx, user, bookingId);
      const staffId = ctx.staffId ?? (await this.ownerAsStaff(tx, user, ctx.providerId));

      if (!bag.bookingId) {
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(bags).where(eq(bags.bookingId, bookingId));
        if (n >= ctx.quantity) throw conflict('bag.too_many', 'All bags on this booking are already tagged');
        await tx.update(bags).set({ bookingId, ownerId: ctx.pilgrimId, label: s.label ?? bag.label }).where(eq(bags.id, bag.id));
      }

      const rule = BAG_HANDOVER_POINTS[s.placeLabel];
      const [scan] = await tx
        .insert(bagScans)
        .values({ bagId: bag.id, placeLabel: s.placeLabel, placeId: s.placeId, staffId, status: rule.status, scannedAt: s.scannedAt, clientId: s.clientId })
        .returning();

      // An older scan arriving late (offline) is stored in the log but doesn't move the bag back.
      const [{ latest }] = await tx.select({ latest: max(bagScans.scannedAt) }).from(bagScans).where(eq(bagScans.bagId, bag.id));
      const isLatest = !latest || new Date(latest).getTime() <= s.scannedAt.getTime();
      let newStatus: BagStatus = bag.status;
      if (isLatest) {
        newStatus = rule.status;
        const expected = rule.nextScanWithinMinutes ? new Date(s.scannedAt.getTime() + rule.nextScanWithinMinutes * 60_000) : null;
        await tx.update(bags).set({ status: newStatus, expectedNextScanBy: expected }).where(eq(bags.id, bag.id));
        if (bag.status !== newStatus) {
          await recordStatus(tx, { entityType: 'bag', entityId: bag.id, from: bag.status, to: newStatus, actorId: user.id, reason: `scan at ${s.placeLabel}`, at: s.scannedAt });
        }
        // A bag that was overdue or lost turns up: close its open case.
        const open = await tx.select().from(lostBagCases).where(and(eq(lostBagCases.bagId, bag.id), eq(lostBagCases.status, 'open')));
        for (const c of open) {
          await tx.update(lostBagCases).set({ status: 'resolved', resolvedAt: new Date(), notes: `${c.notes ?? ''}\nFound: scanned at ${s.placeLabel}`.trim() }).where(eq(lostBagCases.id, c.id));
          await recordStatus(tx, { entityType: 'lost_bag_case', entityId: c.id, from: 'open', to: 'resolved', actorId: user.id, reason: 'bag scanned' });
        }
      }
      // The booking moves to in progress with the first handover.
      const b = await lockBooking(tx, bookingId);
      if (b.status === 'accepted') await transitionBooking(tx, b, 'in_progress', { actorId: user.id, reason: 'first bag scan' });
      return {
        result: { tagCode: s.tagCode, clientId: s.clientId, ok: true, scanId: scan.id },
        push: isLatest ? { pilgrimId: ctx.pilgrimId, providerId: ctx.providerId, bagId: bag.id, label: bag.label ?? s.label ?? s.tagCode, status: newStatus, place: s.placeLabel, at: s.scannedAt } : null,
      };
    });

    if ('push' in notify && notify.push) {
      const p = notify.push;
      this.realtime.emit(`user:${p.pilgrimId}`, 'bag.scanned', { bagId: p.bagId, place: p.place, status: p.status, at: p.at.toISOString() });
      this.realtime.emit(`provider:${p.providerId}`, 'bag.scanned', { bagId: p.bagId, place: p.place, status: p.status });
      await this.notifications.toUsers([p.pilgrimId], 'bag.scanned', { bag: p.label, place: placeName(p.place), time: p.at }, { data: { bagId: p.bagId } });
    }
    return notify.result;
  }

  /** A provider owner scanning themselves is recorded as their first staff member (or refused). */
  private async ownerAsStaff(tx: Tx, user: AuthUser, providerId: string): Promise<string> {
    const [m] = await tx.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.providerId, providerId), eq(staffMembers.userId, user.id)));
    if (m) return m.id;
    const [created] = await tx.insert(staffMembers).values({ userId: user.id, providerId, staffRole: 'luggage' }).returning({ id: staffMembers.id });
    return created.id;
  }

  /** Correct a wrong scan by adding a new one that points at it (scans are never edited). */
  async correct(user: AuthUser, scanId: string, placeLabel: BagHandoverPoint) {
    const [scan] = await this.db.select().from(bagScans).where(eq(bagScans.id, scanId));
    if (!scan) throw notFound('bag_scan');
    const [bag] = await this.db.select().from(bags).where(eq(bags.id, scan.bagId));
    const ctx = await this.staffProviderForBooking(this.db as unknown as Tx, user, bag.bookingId!);
    const rule = BAG_HANDOVER_POINTS[placeLabel];
    const [row] = await this.db
      .insert(bagScans)
      .values({ bagId: bag.id, placeLabel, staffId: ctx.staffId ?? scan.staffId, status: rule.status, scannedAt: scan.scannedAt, correctionOfId: scan.id })
      .returning();
    return row;
  }

  // ───────────── reading ─────────────

  /** Pilgrim: my bags with their latest position. */
  async mine(user: AuthUser) {
    return this.db
      .select({ id: bags.id, tagCode: bags.tagCode, label: bags.label, status: bags.status, bookingId: bags.bookingId, expectedNextScanBy: bags.expectedNextScanBy })
      .from(bags)
      .where(eq(bags.ownerId, user.id))
      .orderBy(asc(bags.createdAt));
  }

  /** Timeline of one bag: Picked up at hotel 09:10 → In van 09:25 → … */
  async timeline(user: AuthUser, bagId: string) {
    const [bag] = await this.db.select().from(bags).where(eq(bags.id, bagId));
    if (!bag) throw notFound('bag');
    const [ctx] = bag.bookingId
      ? await this.db.select({ providerId: services.providerId }).from(bookings).innerJoin(services, eq(services.id, bookings.serviceId)).where(eq(bookings.id, bag.bookingId))
      : [];
    const allowed = bag.ownerId === user.id || isAdmin(user) || (ctx && (ownsProvider(user, ctx.providerId) || user.staff.some((s) => s.providerId === ctx.providerId)));
    if (!allowed) throw notFound('bag');
    const scans = await this.db
      .select({ id: bagScans.id, place: bagScans.placeLabel, status: bagScans.status, scannedAt: bagScans.scannedAt, syncedAt: bagScans.syncedAt, correctionOfId: bagScans.correctionOfId, staffName: users.name })
      .from(bagScans)
      .innerJoin(staffMembers, eq(staffMembers.id, bagScans.staffId))
      .innerJoin(users, eq(users.id, staffMembers.userId))
      .where(eq(bagScans.bagId, bagId))
      .orderBy(asc(bagScans.scannedAt));
    const corrected = new Set(scans.map((s) => s.correctionOfId).filter(Boolean));
    const cases = await this.db.select().from(lostBagCases).where(eq(lostBagCases.bagId, bagId)).orderBy(desc(lostBagCases.openedAt));
    return {
      id: bag.id,
      tagCode: bag.tagCode,
      label: bag.label,
      status: bag.status,
      bookingId: bag.bookingId,
      expectedNextScanBy: bag.expectedNextScanBy?.toISOString() ?? null,
      scans: scans.map((s) => ({
        id: s.id,
        place: s.place,
        status: s.status,
        scannedAt: s.scannedAt.toISOString(),
        syncedLate: s.syncedAt.getTime() - s.scannedAt.getTime() > 60_000,
        heldBy: s.staffName.split(' (')[0],
        corrected: corrected.has(s.id),
        isCorrection: Boolean(s.correctionOfId),
      })),
      cases: cases.map((c) => ({ id: c.id, status: c.status, reason: c.reason, openedAt: c.openedAt.toISOString(), resolvedAt: c.resolvedAt?.toISOString() ?? null })),
    };
  }

  /** Pilgrim reports a bag missing: opens a case for the provider and Bidec support. */
  async reportMissing(user: AuthUser, bagId: string, notes?: string) {
    const [bag] = await this.db.select().from(bags).where(eq(bags.id, bagId));
    if (!bag || bag.ownerId !== user.id) throw notFound('bag');
    return this.openCase(bag, 'reported_by_pilgrim', notes ?? 'Reported missing by the pilgrim', user.id);
  }

  private async openCase(bag: typeof bags.$inferSelect, reason: string, notes: string, actorId: string | null) {
    const result = await this.db.transaction(async (tx) => {
      const [open] = await tx.select().from(lostBagCases).where(and(eq(lostBagCases.bagId, bag.id), eq(lostBagCases.status, 'open')));
      if (open) return { c: open, isNew: false };
      const [last] = await tx.select({ id: bagScans.id }).from(bagScans).where(eq(bagScans.bagId, bag.id)).orderBy(desc(bagScans.scannedAt)).limit(1);
      const [c] = await tx.insert(lostBagCases).values({ bagId: bag.id, reason, notes, lastScanId: last?.id }).returning();
      await recordStatus(tx, { entityType: 'lost_bag_case', entityId: c.id, from: null, to: 'open', actorId, reason });
      if (reason === 'overdue_scan' && bag.status !== 'overdue') {
        await tx.update(bags).set({ status: 'overdue' }).where(eq(bags.id, bag.id));
        await recordStatus(tx, { entityType: 'bag', entityId: bag.id, from: bag.status, to: 'overdue', reason: 'expected scan missed' });
      }
      return { c, isNew: true };
    });
    if (result.isNew) {
      const [ctx] = bag.bookingId
        ? await this.db
            .select({ providerId: services.providerId, ownerId: providers.ownerId })
            .from(bookings)
            .innerJoin(services, eq(services.id, bookings.serviceId))
            .innerJoin(providers, eq(providers.id, services.providerId))
            .where(eq(bookings.id, bag.bookingId))
        : [];
      const recipients = [bag.ownerId, ctx?.ownerId].filter(Boolean) as string[];
      await this.notifications.toUsers(recipients, 'bag.case_opened', { bag: bag.label ?? bag.tagCode }, { data: { bagId: bag.id, caseId: result.c.id } });
      this.realtime.emit('admin', 'bag.case_opened', { caseId: result.c.id, bagId: bag.id });
      if (ctx) this.realtime.emit(`provider:${ctx.providerId}`, 'bag.case_opened', { caseId: result.c.id, bagId: bag.id });
    }
    return result.c;
  }

  /** Provider view: bags in their care, overdue scans, open cases. */
  async forProvider(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    const rows = await this.db
      .select({ bag: bags, pilgrim: users.name, bookingStatus: bookings.status })
      .from(bags)
      .innerJoin(bookings, eq(bookings.id, bags.bookingId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(users, eq(users.id, bags.ownerId))
      .where(eq(services.providerId, providerId))
      .orderBy(desc(bags.createdAt))
      .limit(200);
    const ids = rows.map((r) => r.bag.id);
    const open = ids.length ? await this.db.select().from(lostBagCases).where(and(inArray(lostBagCases.bagId, ids), eq(lostBagCases.status, 'open'))) : [];
    const now = Date.now();
    return {
      inCare: rows.filter((r) => ['tagged', 'in_transit', 'stored', 'overdue', 'lost'].includes(r.bag.status)).length,
      overdue: rows.filter((r) => r.bag.status === 'overdue' || (r.bag.expectedNextScanBy && r.bag.expectedNextScanBy.getTime() < now)).length,
      openCases: open.length,
      bags: rows.map((r) => ({
        id: r.bag.id,
        tagCode: r.bag.tagCode,
        label: r.bag.label,
        status: r.bag.status,
        bookingId: r.bag.bookingId,
        pilgrim: r.pilgrim,
        expectedNextScanBy: r.bag.expectedNextScanBy?.toISOString() ?? null,
        openCaseId: open.find((c) => c.bagId === r.bag.id)?.id ?? null,
      })),
    };
  }

  async adminCases(status?: 'open' | 'resolved') {
    return this.db
      .select({ c: lostBagCases, tagCode: bags.tagCode, label: bags.label, bagStatus: bags.status, owner: users.name, bookingId: bags.bookingId })
      .from(lostBagCases)
      .innerJoin(bags, eq(bags.id, lostBagCases.bagId))
      .leftJoin(users, eq(users.id, bags.ownerId))
      .where(status ? eq(lostBagCases.status, status) : undefined)
      .orderBy(desc(lostBagCases.openedAt))
      .limit(100);
  }

  async resolveCase(user: AuthUser, caseId: string, outcome: 'found' | 'lost', notes: string) {
    return this.db.transaction(async (tx) => {
      const [c] = await tx.select().from(lostBagCases).where(eq(lostBagCases.id, caseId)).for('update');
      if (!c) throw notFound('lost_bag_case');
      if (c.status !== 'open') throw conflict('lost_bag_case.closed', 'Case is already closed');
      const [bag] = await tx.select().from(bags).where(eq(bags.id, c.bagId));
      await tx.update(lostBagCases).set({ status: 'resolved', resolvedAt: new Date(), notes: `${c.notes ?? ''}\n${outcome}: ${notes}`.trim() }).where(eq(lostBagCases.id, caseId));
      await recordStatus(tx, { entityType: 'lost_bag_case', entityId: caseId, from: 'open', to: 'resolved', actorId: user.id, reason: `${outcome}: ${notes}` });
      const to: BagStatus = outcome === 'found' ? 'found' : 'lost';
      await tx.update(bags).set({ status: to, expectedNextScanBy: null }).where(eq(bags.id, bag.id));
      await recordStatus(tx, { entityType: 'bag', entityId: bag.id, from: bag.status, to, actorId: user.id, reason: notes });
      await audit(tx, user.id, 'lost_bag_case.resolve', { type: 'lost_bag_case', id: caseId }, { outcome });
      return { id: caseId, outcome };
    });
  }

  // ───────────── job ─────────────

  /** Open a case for every bag whose expected scan is late (every 5 minutes). */
  async markOverdue(now = new Date()): Promise<number> {
    const late = await this.db
      .select()
      .from(bags)
      .where(and(inArray(bags.status, ['tagged', 'in_transit']), lt(bags.expectedNextScanBy, now)));
    for (const bag of late) await this.openCase(bag, 'overdue_scan', 'Opened automatically: expected handover scan missed', null);
    return late.length;
  }

  /** Unlinked pre-printed tags, for the admin tag sheet. */
  async unlinkedTags() {
    return this.db.select({ tagCode: bags.tagCode, createdAt: bags.createdAt }).from(bags).where(isNull(bags.bookingId)).orderBy(desc(bags.createdAt)).limit(500);
  }
}

const PLACE_NAMES: Record<BagHandoverPoint, Record<string, string>> = {
  hotel_lobby: { en: 'Picked up at hotel', ar: 'استُلمت من الفندق', ur: 'ہوٹل سے وصول', id: 'Diambil di hotel', ms: 'Diambil di hotel', tr: 'Otelden alındı' },
  van: { en: 'In the van', ar: 'في الحافلة', ur: 'وین میں', id: 'Di dalam van', ms: 'Dalam van', tr: 'Araçta' },
  storage_room: { en: 'In storage', ar: 'في المخزن', ur: 'اسٹوریج میں', id: 'Di penitipan', ms: 'Dalam simpanan', tr: 'Depoda' },
  shipping_depot: { en: 'At the shipping depot', ar: 'في مستودع الشحن', ur: 'شپنگ ڈپو پر', id: 'Di gudang pengiriman', ms: 'Di depot penghantaran', tr: 'Kargo deposunda' },
  airport_counter: { en: 'At the airport', ar: 'في المطار', ur: 'ایئرپورٹ پر', id: 'Di bandara', ms: 'Di lapangan terbang', tr: 'Havalimanında' },
  checked_in: { en: 'Checked in', ar: 'تم تسجيلها', ur: 'چیک ان ہو گیا', id: 'Sudah check-in', ms: 'Telah daftar masuk', tr: 'Check-in yapıldı' },
  madinah_hotel_lobby: { en: 'Delivered to your Madinah hotel', ar: 'سُلمت إلى فندقك في المدينة', ur: 'مدینہ کے ہوٹل پہنچا دیا', id: 'Diantar ke hotel Madinah', ms: 'Dihantar ke hotel Madinah', tr: 'Medine otelinize teslim edildi' },
  handed_to_pilgrim: { en: 'Handed to you', ar: 'سُلمت إليك', ur: 'آپ کے حوالے', id: 'Diserahkan kepada Anda', ms: 'Diserahkan kepada anda', tr: 'Size teslim edildi' },
};

function placeName(p: BagHandoverPoint) {
  return PLACE_NAMES[p] as { en: string } & Record<string, string>;
}
