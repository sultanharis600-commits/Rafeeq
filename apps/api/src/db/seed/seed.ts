/**
 * Loads the sample data in ./data into the database, replacing whatever is there.
 *
 *   npm run seed            (from apps/api, or `npm run seed` at the repo root)
 *
 * Safety: refuses to run when NODE_ENV=production, when DEMO_MODE is not "true",
 * or when the database holds any user that is not sample data (pass --force to
 * override the last check on a throwaway database).
 *
 * IDs are derived from each record's key, so links like /bookings/<id> stay the
 * same every time the demo is reset. Times are relative to now (Saudi time).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- seed reads untyped JSON fixtures */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import {
  BOOKING_TRANSITIONS,
  ORDER_TRANSITIONS,
  bookingTotal,
  canTransition,
  slotUnits,
  type BookingStatus,
  type OrderStatus,
  type PriceModel,
  type Translated,
} from '@rafeeq/shared';
import { createPool, dbFromPool, type Database } from '../client.js';
import * as s from '../schema.js';
import { routeSteps } from './route-steps.js';

// ───────────────────────────── helpers ─────────────────────────────

const DATA_DIR = join(import.meta.dirname, 'data');
const load = (file: string): any => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));

/** Stable UUID (v5-style layout) from a sample key. */
export function sid(key: string): string {
  const h = createHash('sha1').update(`rafeeq-sample:${key}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

let NOW = new Date();
/** Test email for a sample account: pilgrim-ahmed → ahmed@rafeeq.test, admin-ops → admin-ops@rafeeq.test. */
export function demoEmail(key: string): string {
  return `${key.replace(/^(pilgrim|staff)-/, '')}@rafeeq.test`;
}

const SAUDI_OFFSET_H = 3;

/** UTC Date for "day N from today, at HH:00 Saudi time". */
function saudiTime(dayOffset: number, hour: number, minute = 0): Date {
  const saudiNow = new Date(NOW.getTime() + SAUDI_OFFSET_H * 3600_000);
  return new Date(
    Date.UTC(saudiNow.getUTCFullYear(), saudiNow.getUTCMonth(), saudiNow.getUTCDate() + dayOffset, hour - SAUDI_OFFSET_H, minute),
  );
}
const minutesFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000);

/** Deterministic small offset (metres → degrees) so points near a place don't stack exactly. */
function jitter(key: string, metres = 20): [number, number] {
  const h = createHash('md5').update(key).digest();
  const dx = ((h[0] / 255) * 2 - 1) * metres;
  const dy = ((h[1] / 255) * 2 - 1) * metres;
  return [dy / 111_320, dx / 111_320];
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Shortest path through a status machine from `from` to `to` (breadth-first). */
export function statusPath<S extends string>(table: Record<S, readonly S[]>, from: S, to: S, via?: S): S[] {
  if (via) {
    const first = statusPath(table, from, via);
    return [...first, ...statusPath(table, via, to).slice(1)];
  }
  const queue: S[][] = [[from]];
  const seen = new Set<S>([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === to) return path;
    for (const next of table[last]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  throw new Error(`No status path from ${from} to ${to}`);
}

type EventRow = typeof s.statusEvents.$inferInsert;
function eventsFor(entityType: string, entityId: string, path: string[], start: Date, stepMinutes: number, reason?: string): EventRow[] {
  return path.map((to, i) => ({
    entityType,
    entityId,
    fromStatus: i === 0 ? null : path[i - 1],
    toStatus: to,
    reason: i === path.length - 1 ? (reason ?? 'sample data') : 'sample data',
    at: new Date(Math.min(start.getTime() + i * stepMinutes * 60_000, NOW.getTime())),
  }));
}

// ───────────────────────────── reset ─────────────────────────────

const APP_TABLES = [
  'reconciliation_runs',
  'outbox_messages',
  'content_items',
  'audit_logs',
  'status_events',
  'reviews',
  'walking_routes',
  'lost_alerts',
  'location_points',
  'group_members',
  'travel_groups',
  'lost_bag_cases',
  'bag_scans',
  'bags',
  'order_items',
  'payments',
  'orders',
  'products',
  'payouts',
  'bookings',
  'availability_slots',
  'services',
  'staff_members',
  'emergency_contacts',
  'otp_codes',
  'uploads',
  'providers',
  'users',
  'places',
];

async function reset(db: Database, force: boolean) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.users)
    .where(eq(s.users.isSample, false));
  if (count > 0 && !force) {
    throw new Error(
      `Refusing to reset: the database has ${count} user(s) that are not sample data. ` +
        'Use a demo database, or pass --force if this database is disposable.',
    );
  }
  await db.execute(sql.raw(`TRUNCATE ${APP_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production') throw new Error('The seed never runs in production.');
  if ((process.env.DEMO_MODE ?? 'true') !== 'true') throw new Error('The seed only runs with DEMO_MODE=true.');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = createPool(url);
  const db = dbFromPool(pool);
  try {
    await seedDemo(db, { force });
    await printCounts(db);
  } finally {
    await pool.end();
  }
}

/** Reset the database and load the sample data, in one transaction. Used by `npm run seed` and the tests. */
export async function seedDemo(db: Database, opts: { force?: boolean } = {}): Promise<void> {
  NOW = new Date();
  await db.transaction(async (tx) => {
    await reset(tx as unknown as Database, opts.force ?? false);
    await seed(tx as unknown as Database);
  });
}

async function seed(db: Database) {
  const usersFile = load('users.json');
  const providersFile = load('providers.json');
  const servicesFile = load('services.json');
  const productsFile = load('products.json');
  const placesFile = load('places.json');
  const activity = load('activity.json');

  // Places first (users reference hotels); shop links are filled once providers exist.
  const placeByKey = new Map<string, { id: string; lat: number; lng: number; city: 'makkah' | 'madinah'; name: Translated }>();
  await db.insert(s.places).values(
    placesFile.places.map((p: any) => {
      const id = sid(p.key);
      placeByKey.set(p.key, { id, lat: p.lat, lng: p.lng, city: p.city, name: p.name });
      return {
        id,
        type: p.type,
        city: p.city,
        name: p.name,
        description: p.description,
        lat: p.lat,
        lng: p.lng,
        hours: p.hours,
        languages: p.languages ?? [],
        priceRange: p.priceRange,
        sells: p.sells ?? [],
        isSample: true,
      };
    }),
  );
  const place = (key: string) => {
    const p = placeByKey.get(key);
    if (!p) throw new Error(`Unknown place ${key}`);
    return p;
  };

  // Users
  await db.insert(s.users).values(
    usersFile.users.map((u: any) => ({
      id: sid(u.key),
      phone: u.phone,
      email: demoEmail(u.key),
      name: u.name,
      language: u.language,
      nationality: u.nationality,
      role: u.role ?? 'pilgrim',
      accessibilityMode: u.accessibilityMode ?? false,
      accessibilityNeeds: u.accessibilityNeeds ?? [],
      city: u.city,
      hotelPlaceId: u.hotel ? place(u.hotel).id : undefined,
      travelFrom: u.travelDays ? saudiTime(u.travelDays[0], 12) : undefined,
      travelTo: u.travelDays ? saudiTime(u.travelDays[1], 12) : undefined,
      locationSharingAt: u.locationSharing ? saudiTime(-3, 9) : undefined,
      isSample: true,
    })),
  );
  const userHotel = new Map<string, string | undefined>(usersFile.users.map((u: any) => [u.key, u.hotel]));
  const userNeeds = new Map<string, string[]>(usersFile.users.map((u: any) => [u.key, u.accessibilityNeeds ?? []]));

  await db.insert(s.emergencyContacts).values(
    usersFile.emergencyContacts.map((c: any) => ({ userId: sid(c.user), name: c.name, phone: c.phone, relation: c.relation })),
  );

  // Providers and staff
  await db.insert(s.providers).values(
    providersFile.providers.map((p: any) => ({
      id: sid(p.key),
      ownerId: sid(p.owner),
      type: p.type,
      kind: p.kind,
      name: p.name,
      description: p.description,
      crNumber: p.crNumber,
      status: p.status,
      commissionRateBps: p.commissionRateBps ?? 1500,
      city: p.city,
      documents: [
        { kind: p.type === 'company' ? 'commercial_registration' : 'national_id', url: `sample://${p.key}/id.pdf`, verified: p.status === 'approved' },
      ],
      isSample: true,
    })),
  );
  for (const p of providersFile.providers) {
    await db.insert(s.statusEvents).values(
      eventsFor('provider', sid(p.key), statusPath(PROVIDER_FLOW, 'pending', p.status), saudiTime(-30, 10), 60 * 24),
    );
  }
  await db.insert(s.staffMembers).values(
    providersFile.staff.map((st: any) => ({
      id: sid(`staff:${st.user}`),
      userId: sid(st.user),
      providerId: sid(st.provider),
      staffRole: st.staffRole,
      vehicle: st.vehicle,
      isSample: true,
    })),
  );
  const staffId = (userKey: string) => sid(`staff:${userKey}`);

  for (const p of placesFile.places.filter((x: any) => x.shop)) {
    await db.update(s.places).set({ shopProviderId: sid(p.shop) }).where(eq(s.places.id, sid(p.key)));
  }

  // Services and availability (7 days back for history, 7 days ahead for booking)
  const serviceByKey = new Map<string, any>();
  await db.insert(s.services).values(
    servicesFile.services.map((sv: any) => {
      serviceByKey.set(sv.key, sv);
      return {
        id: sid(sv.key),
        providerId: sid(sv.provider),
        category: sv.category,
        title: sv.title,
        description: sv.description,
        priceHalalas: sv.priceHalalas,
        priceModel: sv.priceModel,
        durationMinutes: sv.durationMinutes,
        options: sv.options,
        languagesSpoken: sv.languagesSpoken,
        serviceArea: sv.serviceArea,
        isSample: true,
      };
    }),
  );
  const slotRows: (typeof s.availabilitySlots.$inferInsert)[] = [];
  const slotKey = (serviceKey: string, day: number, hour: number) => `slot:${serviceKey}:${day}:${hour}`;
  for (const sv of servicesFile.services) {
    for (let day = -7; day <= 7; day++) {
      for (const hour of sv.slots.hours as number[]) {
        const startsAt = saudiTime(day, hour);
        slotRows.push({
          id: sid(slotKey(sv.key, day, hour)),
          serviceId: sid(sv.key),
          startsAt,
          endsAt: new Date(startsAt.getTime() + Math.min(sv.durationMinutes ?? 60, 240) * 60_000),
          capacity: sv.slots.capacity,
        });
      }
    }
  }
  await db.insert(s.availabilitySlots).values(slotRows);

  // Bookings, payments and their status history
  const bookingByKey = new Map<string, { id: string; serviceKey: string; status: BookingStatus; pilgrim: string }>();
  for (const b of activity.bookings) {
    const sv = serviceByKey.get(b.service);
    if (!sv) throw new Error(`Booking ${b.key}: unknown service ${b.service}`);
    if (!(sv.slots.hours as number[]).includes(b.hour)) throw new Error(`Booking ${b.key}: no slot at ${b.hour}:00 for ${b.service}`);
    const quantity = b.quantity ?? 1;
    const optionPrices = (b.options ?? []).map((k: string) => {
      const opt = (sv.options ?? []).find((o: any) => o.key === k);
      if (!opt) throw new Error(`Booking ${b.key}: unknown option ${k}`);
      return opt.priceHalalas as number;
    });
    const total = bookingTotal(sv.priceModel as PriceModel, sv.priceHalalas, quantity, optionPrices);
    const id = sid(b.key);
    const slotId = sid(slotKey(b.service, b.day, b.hour));
    const status = b.status as BookingStatus;
    bookingByKey.set(b.key, { id, serviceKey: b.service, status, pilgrim: b.pilgrim });

    const hotelKey = userHotel.get(b.pilgrim);
    const dropoff = b.dropoff ? place(b.dropoff) : undefined;
    await db.insert(s.bookings).values({
      id,
      pilgrimId: sid(b.pilgrim),
      serviceId: sid(b.service),
      slotId,
      quantity,
      options: b.options,
      totalHalalas: total,
      status,
      assignedStaffId: b.staff ? staffId(b.staff) : undefined,
      meetingPoint: b.meetingPoint ?? (hotelKey ? `${place(hotelKey).name.en}, lobby` : undefined),
      pickup: b.pickup ? { lat: 21.6796, lng: 39.1565, label: b.pickup } : undefined,
      dropoff: dropoff ? { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.name.en } : undefined,
      needs: userNeeds.get(b.pilgrim) ?? [],
      notes: b.notes,
      // Sample bookings waiting for the provider get a generous deadline so the demo stays stable.
      acceptBy: status === 'paid' ? new Date(NOW.getTime() + 6 * 3600_000) : undefined,
      isSample: true,
      createdAt: saudiTime(Math.min(b.day, 0) - 2, 20),
    });

    const holdsCapacity = !['declined', 'cancelled', 'refunded', 'pending_payment'].includes(status);
    if (holdsCapacity) {
      await db
        .update(s.availabilitySlots)
        .set({ booked: sql`${s.availabilitySlots.booked} + ${slotUnits(sv.priceModel, quantity)}` })
        .where(eq(s.availabilitySlots.id, slotId));
    }

    const path = statusPath(BOOKING_TRANSITIONS, 'pending_payment', status, b.via);
    const createdAt = saudiTime(Math.min(b.day, 0) - 2, 20);
    const slotStart = saudiTime(b.day, b.hour);
    const slotEnd = new Date(slotStart.getTime() + (sv.durationMinutes ?? 60) * 60_000);
    await db.insert(s.statusEvents).values(
      path.map((to, i) => ({
        entityType: 'booking',
        entityId: id,
        fromStatus: i === 0 ? null : path[i - 1],
        toStatus: to,
        reason: i === path.length - 1 && b.reason ? b.reason : 'sample data',
        at: bookingEventTime(to, createdAt, slotStart, slotEnd),
      })),
    );

    if (status !== 'pending_payment') {
      const refunded = status === 'refunded';
      await db.insert(s.payments).values({
        id: sid(`payment:${b.key}`),
        bookingId: id,
        gateway: 'sandbox',
        gatewayRef: `sandbox_${b.key}`,
        method: ['card', 'mada', 'apple_pay', 'stc_pay'][b.key.charCodeAt(2) % 4],
        amountHalalas: total,
        refundedHalalas: refunded ? total : 0,
        status: refunded ? 'refunded' : 'succeeded',
        isSample: true,
      });
    }
  }

  // Bags, append-only scans and lost-bag cases
  for (const bag of activity.bags) {
    const booking = bookingByKey.get(bag.booking);
    if (!booking) throw new Error(`Bag ${bag.tagCode}: unknown booking ${bag.booking}`);
    const bagId = sid(`bag:${bag.tagCode}`);
    await db.insert(s.bags).values({
      id: bagId,
      tagCode: bag.tagCode,
      bookingId: booking.id,
      ownerId: sid(booking.pilgrim),
      label: bag.label,
      status: bag.status,
      expectedNextScanBy: bag.expectNextScanInMinutes !== undefined ? minutesFromNow(bag.expectNextScanInMinutes) : null,
      isSample: true,
    });
    let lastScanId: string | undefined;
    let prevStatus: string | null = null;
    const scans = bag.scans as [string, string, number][];
    for (let i = 0; i < scans.length; i++) {
      const [placeLabel, staffKey, minutes] = scans[i];
      const isLast = i === scans.length - 1;
      const scanStatus = placeLabel === 'storage_room' ? 'stored' : isLast && bag.status === 'delivered' ? 'delivered' : 'in_transit';
      lastScanId = sid(`scan:${bag.tagCode}:${i}`);
      await db.insert(s.bagScans).values({
        id: lastScanId,
        bagId,
        placeLabel,
        staffId: staffId(staffKey),
        status: scanStatus,
        scannedAt: minutesFromNow(minutes),
        syncedAt: minutesFromNow(minutes + (i === 1 ? 7 : 0)), // one scan synced late (offline)
        isSample: true,
      });
      await db.insert(s.statusEvents).values({
        entityType: 'bag',
        entityId: bagId,
        fromStatus: prevStatus ?? 'tagged',
        toStatus: scanStatus,
        actorId: sid(staffKey),
        reason: `scan at ${placeLabel}`,
        at: minutesFromNow(minutes),
      });
      prevStatus = scanStatus;
    }
    if (bag.status === 'overdue') {
      await db.insert(s.statusEvents).values({
        entityType: 'bag',
        entityId: bagId,
        fromStatus: prevStatus,
        toStatus: 'overdue',
        reason: 'expected scan missed',
        at: minutesFromNow(bag.expectNextScanInMinutes),
      });
    }
    if (bag.lostCase) {
      await db.insert(s.lostBagCases).values({
        id: sid(`case:${bag.tagCode}`),
        bagId,
        reason: 'overdue_scan',
        lastScanId,
        notes: 'Opened automatically: no scan at the van after the hotel lobby.',
        openedAt: minutesFromNow(bag.expectNextScanInMinutes),
        isSample: true,
      });
    }
  }

  // Products
  const productByKey = new Map<string, any>();
  await db.insert(s.products).values(
    productsFile.products.map((p: any) => {
      productByKey.set(p.key, p);
      return {
        id: sid(p.key),
        shopId: sid(p.shop),
        section: p.section,
        title: p.title,
        description: p.description,
        priceHalalas: p.priceHalalas,
        stock: p.stock,
        weightGrams: p.weightGrams,
        isFood: p.isFood ?? false,
        shipsAbroad: true,
        // Empty list = any country the courier serves. Food only to countries the courier confirmed.
        shipsToCountries: p.isFood ? productsFile.foodCountries : [],
        isSample: true,
      };
    }),
  );

  // Orders
  const GIFT_WRAP_HALALAS = 1000;
  for (const o of activity.orders) {
    const id = sid(o.key);
    const items = (o.items as [string, number][]).map(([key, qty]) => {
      const p = productByKey.get(key);
      if (!p) throw new Error(`Order ${o.key}: unknown product ${key}`);
      if (sid(p.shop) !== sid(o.shop)) throw new Error(`Order ${o.key}: ${key} is not sold by ${o.shop}`);
      if (o.delivery === 'international' && p.isFood && !productsFile.foodCountries.includes(o.country)) {
        throw new Error(`Order ${o.key}: ${key} cannot ship to ${o.country}`);
      }
      return { productId: sid(key), quantity: qty, unitPriceHalalas: p.priceHalalas as number };
    });
    const subtotal = items.reduce((sum, it) => sum + it.unitPriceHalalas * it.quantity, 0);
    const shipping = o.shippingHalalas ?? 0;
    const giftWrap = o.giftWrap ? GIFT_WRAP_HALALAS : 0;
    const total = subtotal + shipping + giftWrap;
    const status = o.status as OrderStatus;
    const hotelKey = userHotel.get(o.pilgrim);
    const createdAt = saudiTime(-o.daysAgo, 9);

    await db.insert(s.orders).values({
      id,
      pilgrimId: sid(o.pilgrim),
      shopId: sid(o.shop),
      deliveryType: o.delivery,
      address:
        o.delivery === 'hotel'
          ? { kind: 'hotel', placeId: place(hotelKey!).id, room: '1204' }
          : { kind: 'international', line1: 'Sample address 1', city: 'Sample city', country: o.country },
      country: o.country,
      subtotalHalalas: subtotal,
      shippingHalalas: shipping,
      giftWrapHalalas: giftWrap,
      totalHalalas: total,
      giftMessage: o.giftMessage,
      status,
      trackingNumber: o.trackingNumber,
      courier: o.courier,
      isSample: true,
      createdAt,
    });
    await db.insert(s.orderItems).values(items.map((it) => ({ ...it, orderId: id })));

    const lastLeg = o.delivery === 'hotel' ? 'out_for_delivery' : 'shipped';
    const via = status === 'delivered' ? lastLeg : status === 'refunded' ? 'cancelled' : undefined;
    const path = statusPath(ORDER_TRANSITIONS, 'pending_payment', status, via as OrderStatus | undefined);
    if (!path.every((st, i) => i === 0 || canTransition(ORDER_TRANSITIONS, path[i - 1], st))) {
      throw new Error(`Order ${o.key}: invalid status path`);
    }
    await db.insert(s.statusEvents).values(eventsFor('order', id, path, createdAt, 120));
    const refunded = status === 'refunded';
    await db.insert(s.payments).values({
      id: sid(`payment:${o.key}`),
      orderId: id,
      gateway: 'sandbox',
      gatewayRef: `sandbox_${o.key}`,
      method: 'card',
      amountHalalas: total,
      refundedHalalas: refunded ? total : 0,
      status: refunded ? 'refunded' : 'succeeded',
      isSample: true,
    });
  }

  // Travel groups, last known locations and alerts
  for (const g of activity.groups) {
    await db.insert(s.travelGroups).values({
      id: sid(g.key),
      name: g.name,
      joinCode: g.joinCode,
      leaderId: sid(g.leader),
      isSample: true,
    });
    await db.insert(s.groupMembers).values(
      g.members.map((m: any) => ({
        groupId: sid(g.key),
        userId: sid(m.user),
        role: m.role ?? 'member',
        relation: m.relation,
        trackerTag: m.trackerTag,
        bleId: createHash('sha1').update(`ble:${m.user}`).digest('hex').slice(0, 12),
      })),
    );
  }
  await db.insert(s.locationPoints).values(
    activity.locationPoints.map((lp: any, i: number) => {
      const p = place(lp.place);
      const [dLat, dLng] = jitter(`${lp.user}:${i}`, 30);
      return {
        userId: sid(lp.user),
        lat: p.lat + dLat,
        lng: p.lng + dLng,
        accuracyM: lp.accuracyM,
        source: lp.source,
        recordedAt: minutesFromNow(-lp.minutesAgo),
        receivedAt: minutesFromNow(-lp.minutesAgo + 1),
      };
    }),
  );
  for (const a of activity.lostAlerts) {
    const p = place(a.place);
    const createdAt = minutesFromNow(-a.minutesAgo);
    const resolvedAt = a.resolvedAfterMinutes ? minutesFromNow(-a.minutesAgo + a.resolvedAfterMinutes) : null;
    await db.insert(s.lostAlerts).values({
      id: sid(a.key),
      userId: sid(a.user),
      groupId: sid(a.group),
      channel: a.channel,
      status: a.status,
      lat: p.lat,
      lng: p.lng,
      message: a.message,
      isSample: true,
      createdAt,
      resolvedAt,
    });
    await db.insert(s.statusEvents).values(
      eventsFor('lost_alert', sid(a.key), ['open', 'acknowledged', a.status], createdAt, Math.max(1, Math.floor((a.resolvedAfterMinutes ?? 2) / 2))),
    );
  }

  // Walking routes (sample geometry: straight legs with one bend; real routes come from the offline map pack)
  await db.insert(s.walkingRoutes).values(
    placesFile.routes.map((r: any) => {
      const from = place(r.from);
      const to = place(r.to);
      const bend = { lat: from.lat, lng: to.lng };
      const leg1 = haversineM(from, bend);
      const leg2 = haversineM(bend, to);
      const distanceM = Math.round(leg1 + leg2);
      const metresPerMinute = r.accessible ? 50 : 70;
      return {
        id: sid(`route:${r.key}`),
        city: from.city,
        fromPlaceId: from.id,
        toPlaceId: to.id,
        distanceM,
        minutes: Math.max(1, Math.round(distanceM / metresPerMinute)),
        accessible: r.accessible,
        path: [
          [from.lat, from.lng],
          [bend.lat, bend.lng],
          [to.lat, to.lng],
        ] as [number, number][],
        steps: routeSteps(from, bend, to, Math.round(leg1), Math.round(leg2)),
        isSample: true,
      };
    }),
  );

  // Home banners and help articles
  await db.insert(s.contentItems).values(
    activity.content.map((c: any, i: number) => ({ id: sid(`content:${c.key}`), kind: c.kind, title: c.title, body: c.body, link: c.link, city: c.city, sortOrder: i, isSample: true })),
  );

  // Reviews
  await db.insert(s.reviews).values(
    activity.reviews.map((rv: any) => {
      if (rv.booking) {
        const b = bookingByKey.get(rv.booking)!;
        const sv = serviceByKey.get(b.serviceKey);
        return {
          authorId: sid(rv.author),
          bookingId: b.id,
          serviceId: sid(b.serviceKey),
          providerId: sid(sv.provider),
          rating: rv.rating,
          text: rv.text,
          language: rv.language,
          isSample: true,
        };
      }
      const order = activity.orders.find((o: any) => o.key === rv.order);
      return {
        authorId: sid(rv.author),
        orderId: sid(order.key),
        providerId: sid(order.shop),
        rating: rv.rating,
        text: rv.text,
        language: rv.language,
        isSample: true,
      };
    }),
  );
}

/** Realistic moment for each booking status: payment right after booking, work during the slot. */
function bookingEventTime(status: BookingStatus, createdAt: Date, slotStart: Date, slotEnd: Date): Date {
  const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
  const at: Record<BookingStatus, Date> = {
    pending_payment: createdAt,
    paid: plus(createdAt, 4),
    accepted: plus(createdAt, 35),
    declined: plus(createdAt, 35),
    cancelled: plus(createdAt, 24 * 60),
    refunded: plus(createdAt, 24 * 60 + 10),
    in_progress: slotStart,
    completed: slotEnd,
    disputed: plus(slotEnd, 60),
    paid_out: plus(slotEnd, 3 * 24 * 60),
  };
  return new Date(Math.min(at[status].getTime(), NOW.getTime()));
}

const PROVIDER_FLOW = {
  pending: ['approved', 'rejected'],
  approved: ['suspended'],
  suspended: ['approved'],
  rejected: [],
} as const satisfies Record<string, readonly string[]>;

async function printCounts(db: Database) {
  const tables = {
    users: s.users,
    providers: s.providers,
    staff: s.staffMembers,
    services: s.services,
    slots: s.availabilitySlots,
    bookings: s.bookings,
    payments: s.payments,
    products: s.products,
    orders: s.orders,
    bags: s.bags,
    bagScans: s.bagScans,
    lostBagCases: s.lostBagCases,
    places: s.places,
    walkingRoutes: s.walkingRoutes,
    travelGroups: s.travelGroups,
    groupMembers: s.groupMembers,
    reviews: s.reviews,
    statusEvents: s.statusEvents,
  };
  const out: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
    out[name] = count;
  }
  const [{ pilgrims }] = await db
    .select({ pilgrims: sql<number>`count(*)::int` })
    .from(s.users)
    .where(and(eq(s.users.role, 'pilgrim'), eq(s.users.isSample, true)));
  console.log('Sample data loaded:');
  console.table({ ...out, pilgrims });
}

// Run only when executed directly (the tests import the helpers above).
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
