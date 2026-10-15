/**
 * Rafeeq data model (Drizzle ORM). Rules (see AI_RULES.md):
 * - money in integer halalas (*Halalas columns)
 * - times in UTC (timestamptz)
 * - translated text as JSON keyed by language: { en, ar, ur, id, ms, tr }
 * - every status change writes a status_events row
 * - isSample marks demo data loaded by the seed script
 */
import { relations } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Translated } from '@rafeeq/shared';

const id = () => uuid('id').primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const isSample = () => boolean('is_sample').notNull().default(false);
const tr = (name: string) => jsonb(name).$type<Translated>();

// ───────────────────────────── Enums ─────────────────────────────

export const roleEnum = pgEnum('role', [
  'pilgrim',
  'provider_owner',
  'staff',
  'admin_ops',
  'admin_finance',
  'admin_support',
]);
export const languageEnum = pgEnum('language', ['ar', 'en', 'ur', 'id', 'ms', 'tr']);
export const cityEnum = pgEnum('city', ['makkah', 'madinah']);
export const providerTypeEnum = pgEnum('provider_type', ['company', 'individual']);
export const providerKindEnum = pgEnum('provider_kind', ['services', 'shop']);
export const providerStatusEnum = pgEnum('provider_status', ['pending', 'approved', 'suspended', 'rejected']);
export const staffRoleEnum = pgEnum('staff_role', ['driver', 'guide', 'photographer', 'luggage', 'assistant']);
export const serviceCategoryEnum = pgEnum('service_category', [
  'transport',
  'guides',
  'photography',
  'luggage',
  'accessibility',
  'heritage_tours',
]);
export const priceModelEnum = pgEnum('price_model', ['per_trip', 'per_hour', 'per_person', 'per_bag', 'per_tag', 'fixed']);
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_payment',
  'paid',
  'accepted',
  'in_progress',
  'completed',
  'paid_out',
  'declined',
  'cancelled',
  'refunded',
  'disputed',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'initiated',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
]);
export const payoutStatusEnum = pgEnum('payout_status', ['calculated', 'approved', 'sent', 'failed']);
export const productSectionEnum = pgEnum('product_section', ['makkah_gifts', 'madinah_gifts', 'dates']);
export const deliveryTypeEnum = pgEnum('delivery_type', ['hotel', 'international']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'packed',
  'out_for_delivery',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);
export const bagStatusEnum = pgEnum('bag_status', ['tagged', 'in_transit', 'stored', 'delivered', 'overdue', 'lost', 'found']);
export const caseStatusEnum = pgEnum('case_status', ['open', 'resolved']);
export const alertStatusEnum = pgEnum('alert_status', ['open', 'acknowledged', 'resolved']);
export const placeTypeEnum = pgEnum('place_type', [
  'holy_site',
  'shopping',
  'gate',
  'lost_and_found',
  'gathering_point',
  'hotel',
  'toilet',
]);

// ───────────────────────────── Places (referenced by users) ─────────────────────────────

export const places = pgTable(
  'places',
  {
    id: id(),
    type: placeTypeEnum('type').notNull(),
    city: cityEnum('city').notNull(),
    name: tr('name').notNull(),
    description: tr('description'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    hours: jsonb('hours').$type<Record<string, string>>(), // { always: "24h" } or { sat: "09:00-23:00", ... }
    languages: languageEnum('languages').array().notNull().default([]),
    priceRange: integer('price_range'), // 1–3
    sells: productSectionEnum('sells').array().notNull().default([]),
    shopProviderId: uuid('shop_provider_id').references((): AnyPgColumn => providers.id), // set when the place sells on Rafeeq → "Shop online"
    isSample: isSample(),
  },
  (t) => [index('places_city_type_idx').on(t.city, t.type)],
);

// ───────────────────────────── Users ─────────────────────────────

export const users = pgTable('users', {
  id: id(),
  phone: text('phone').notNull().unique(),
  /** Optional; used for the demo-mode quick login and, later, receipts. Stored lower-case. */
  email: text('email').unique(),
  name: text('name').notNull(),
  language: languageEnum('language').notNull().default('en'),
  nationality: text('nationality'), // ISO 3166-1 alpha-2
  role: roleEnum('role').notNull().default('pilgrim'),
  accessibilityMode: boolean('accessibility_mode').notNull().default(false),
  accessibilityNeeds: text('accessibility_needs').array().notNull().default([]),
  locationSharingAt: ts('location_sharing_at'), // consent to share location with travel groups; null = off
  city: cityEnum('city'),
  hotelPlaceId: uuid('hotel_place_id').references((): AnyPgColumn => places.id),
  travelFrom: ts('travel_from'),
  travelTo: ts('travel_to'),
  isSample: isSample(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_phone_created_idx').on(t.phone, t.createdAt)],
);

export const emergencyContacts = pgTable('emergency_contacts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  relation: text('relation'),
  createdAt: createdAt(),
});

// ───────────────────────────── Providers ─────────────────────────────

export type ProviderDocument = { kind: string; url: string; verified: boolean };

export const providers = pgTable('providers', {
  id: id(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  type: providerTypeEnum('type').notNull(),
  kind: providerKindEnum('kind').notNull().default('services'),
  name: tr('name').notNull(),
  description: tr('description'),
  crNumber: text('cr_number'), // Commercial Registration
  status: providerStatusEnum('status').notNull().default('pending'),
  ibanEncrypted: text('iban_encrypted'), // encrypted at rest; never returned by the API
  commissionRateBps: integer('commission_rate_bps').notNull().default(1500), // 1500 = 15%
  commissionFreeUntil: ts('commission_free_until'), // first 3 months free for early providers
  city: cityEnum('city').notNull(),
  phone: text('phone'),
  documents: jsonb('documents').$type<ProviderDocument[]>(),
  isSample: isSample(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const staffMembers = pgTable(
  'staff_members',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id),
    staffRole: staffRoleEnum('staff_role').notNull(),
    vehicle: text('vehicle'),
    active: boolean('active').notNull().default(true),
    isSample: isSample(),
  },
  (t) => [uniqueIndex('staff_user_provider_uq').on(t.userId, t.providerId)],
);

// ───────────────────────────── Catalogue ─────────────────────────────

export type ServiceOption = { key: string; title: Translated; priceHalalas: number };

export const services = pgTable(
  'services',
  {
    id: id(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id),
    category: serviceCategoryEnum('category').notNull(),
    title: tr('title').notNull(),
    description: tr('description'),
    priceHalalas: integer('price_halalas').notNull(),
    priceModel: priceModelEnum('price_model').notNull().default('fixed'),
    durationMinutes: integer('duration_minutes'),
    options: jsonb('options').$type<ServiceOption[]>(),
    languagesSpoken: languageEnum('languages_spoken').array().notNull().default([]),
    serviceArea: cityEnum('service_area').notNull(),
    cancellationPolicy: text('cancellation_policy').notNull().default('flexible'), // flexible | moderate | strict
    active: boolean('active').notNull().default(true),
    isSample: isSample(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('services_cat_area_idx').on(t.category, t.serviceArea, t.active)],
);

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: id(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    capacity: integer('capacity').notNull(),
    booked: integer('booked').notNull().default(0),
    held: integer('held').notNull().default(0), // held during payment, released after 10 min
    blocked: boolean('blocked').notNull().default(false),
  },
  (t) => [index('slots_service_start_idx').on(t.serviceId, t.startsAt)],
);

// ───────────────────────────── Bookings and payments ─────────────────────────────

export type GeoPoint = { lat: number; lng: number; label?: string };

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    pilgrimId: uuid('pilgrim_id')
      .notNull()
      .references(() => users.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    slotId: uuid('slot_id').references(() => availabilitySlots.id),
    quantity: integer('quantity').notNull().default(1),
    options: jsonb('options').$type<string[]>(),
    totalHalalas: integer('total_halalas').notNull(),
    status: bookingStatusEnum('status').notNull().default('pending_payment'),
    holdExpiresAt: ts('hold_expires_at'),
    acceptBy: ts('accept_by'), // provider must accept before this, else auto-refund offer
    assignedStaffId: uuid('assigned_staff_id').references(() => staffMembers.id),
    meetingPoint: text('meeting_point'),
    pickup: jsonb('pickup').$type<GeoPoint>(),
    dropoff: jsonb('dropoff').$type<GeoPoint>(),
    needs: text('needs').array().notNull().default([]), // accessibility needs copied from the profile
    payoutId: uuid('payout_id'), // set when the booking is included in a provider payout
    liveLocation: jsonb('live_location').$type<GeoPoint & { at: string }>(), // staff position while in progress
    notes: text('notes'),
    isSample: isSample(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('bookings_pilgrim_idx').on(t.pilgrimId, t.createdAt),
    index('bookings_service_status_idx').on(t.serviceId, t.status),
  ],
);

export const payments = pgTable('payments', {
  id: id(),
  bookingId: uuid('booking_id').references(() => bookings.id),
  orderId: uuid('order_id').references(() => orders.id),
  gateway: text('gateway').notNull(), // "sandbox" in the MVP
  gatewayRef: text('gateway_ref').unique(),
  method: text('method'), // card | mada | apple_pay | stc_pay
  amountHalalas: integer('amount_halalas').notNull(),
  refundedHalalas: integer('refunded_halalas').notNull().default(0),
  status: paymentStatusEnum('status').notNull().default('initiated'),
  isSample: isSample(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type PayoutLine = { kind: 'booking' | 'order'; id: string; grossHalalas: number; commissionHalalas: number };

export const payouts = pgTable(
  'payouts',
  {
    id: id(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id),
    periodStart: ts('period_start').notNull(),
    periodEnd: ts('period_end').notNull(),
    grossHalalas: integer('gross_halalas').notNull(),
    commissionHalalas: integer('commission_halalas').notNull(),
    netHalalas: integer('net_halalas').notNull(),
    status: payoutStatusEnum('status').notNull().default('calculated'),
    lines: jsonb('lines').$type<PayoutLine[]>().notNull(),
    isSample: isSample(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payouts_provider_period_uq').on(t.providerId, t.periodStart)],
);

// ───────────────────────────── Shop ─────────────────────────────

export const products = pgTable(
  'products',
  {
    id: id(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => providers.id),
    section: productSectionEnum('section').notNull(),
    title: tr('title').notNull(),
    description: tr('description'),
    priceHalalas: integer('price_halalas').notNull(),
    stock: integer('stock').notNull(),
    lowStockAlert: integer('low_stock_alert').notNull().default(5),
    weightGrams: integer('weight_grams').notNull(),
    isFood: boolean('is_food').notNull().default(false),
    shipsAbroad: boolean('ships_abroad').notNull().default(false),
    shipsToCountries: text('ships_to_countries').array().notNull().default([]), // ISO codes the courier confirmed
    active: boolean('active').notNull().default(true),
    isSample: isSample(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_section_idx').on(t.section, t.active)],
);

export type OrderAddress =
  | { kind: 'hotel'; placeId: string; room?: string }
  | { kind: 'international'; line1: string; city: string; country: string; postcode?: string };

export const orders = pgTable(
  'orders',
  {
    id: id(),
    pilgrimId: uuid('pilgrim_id')
      .notNull()
      .references(() => users.id),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => providers.id),
    deliveryType: deliveryTypeEnum('delivery_type').notNull(),
    address: jsonb('address').$type<OrderAddress>().notNull(),
    country: text('country'),
    subtotalHalalas: integer('subtotal_halalas').notNull(),
    shippingHalalas: integer('shipping_halalas').notNull().default(0),
    giftWrapHalalas: integer('gift_wrap_halalas').notNull().default(0),
    totalHalalas: integer('total_halalas').notNull(),
    giftMessage: text('gift_message'),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    trackingNumber: text('tracking_number'),
    courier: text('courier'),
    payoutId: uuid('payout_id'),
    isSample: isSample(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('orders_pilgrim_idx').on(t.pilgrimId, t.createdAt), index('orders_shop_status_idx').on(t.shopId, t.status)],
);

export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceHalalas: integer('unit_price_halalas').notNull(),
});

// ───────────────────────────── Baggage tracking ─────────────────────────────

export const bags = pgTable('bags', {
  id: id(),
  tagCode: text('tag_code').notNull().unique(), // random code on the QR tag; never personal data
  bookingId: uuid('booking_id').references(() => bookings.id),
  ownerId: uuid('owner_id').references(() => users.id),
  label: text('label'),
  status: bagStatusEnum('status').notNull().default('tagged'),
  expectedNextScanBy: ts('expected_next_scan_by'),
  isSample: isSample(),
  createdAt: createdAt(),
});

/** Append-only: never update or delete; corrections point at the scan they fix. */
export const bagScans = pgTable(
  'bag_scans',
  {
    id: id(),
    bagId: uuid('bag_id')
      .notNull()
      .references(() => bags.id),
    placeLabel: text('place_label').notNull(), // hotel_lobby | van | storage | airport_counter | ...
    placeId: uuid('place_id').references(() => places.id),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffMembers.id),
    status: bagStatusEnum('status').notNull(),
    scannedAt: ts('scanned_at').notNull(), // when it happened on the phone
    syncedAt: ts('synced_at').notNull().defaultNow(), // when it reached the server
    correctionOfId: uuid('correction_of_id'),
    clientId: text('client_id').unique(), // set by the phone so an offline scan synced twice is stored once
    isSample: isSample(),
  },
  (t) => [index('bag_scans_bag_idx').on(t.bagId, t.scannedAt)],
);

export const lostBagCases = pgTable('lost_bag_cases', {
  id: id(),
  bagId: uuid('bag_id')
    .notNull()
    .references(() => bags.id),
  reason: text('reason').notNull(), // overdue_scan | reported_by_pilgrim
  status: caseStatusEnum('status').notNull().default('open'),
  lastScanId: uuid('last_scan_id').references(() => bagScans.id),
  notes: text('notes'),
  openedAt: ts('opened_at').notNull().defaultNow(),
  resolvedAt: ts('resolved_at'),
  isSample: isSample(),
});

// ───────────────────────────── Groups and safety (Lost Companion) ─────────────────────────────

export const travelGroups = pgTable('travel_groups', {
  id: id(),
  name: text('name').notNull(),
  joinCode: text('join_code').notNull().unique(), // shown as a QR code
  leaderId: uuid('leader_id')
    .notNull()
    .references(() => users.id),
  isSample: isSample(),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  'group_members',
  {
    id: id(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => travelGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull().default('member'), // leader | member
    relation: text('relation'),
    trackerTag: text('tracker_tag'), // AirTag / Google tag label, if carried
    bleId: text('ble_id'), // rotating ID for the Bluetooth nearby finder
    joinedAt: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('group_member_uq').on(t.groupId, t.userId)],
);

export const locationPoints = pgTable(
  'location_points',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    accuracyM: doublePrecision('accuracy_m'),
    source: text('source').notNull(), // gps | sms | tag
    recordedAt: ts('recorded_at').notNull(),
    receivedAt: ts('received_at').notNull().defaultNow(),
  },
  (t) => [index('location_user_idx').on(t.userId, t.recordedAt)],
);

export const lostAlerts = pgTable('lost_alerts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  groupId: uuid('group_id').references(() => travelGroups.id),
  channel: text('channel').notNull(), // app | sms
  status: alertStatusEnum('status').notNull().default('open'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  message: text('message'),
  isSample: isSample(),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
});

// ───────────────────────────── Walking routes ─────────────────────────────

export type RouteStep = { instruction: Translated; distanceM: number; direction: 'straight' | 'left' | 'right' | 'arrive' };

export const walkingRoutes = pgTable('walking_routes', {
  id: id(),
  city: cityEnum('city').notNull(),
  fromPlaceId: uuid('from_place_id')
    .notNull()
    .references(() => places.id),
  toPlaceId: uuid('to_place_id')
    .notNull()
    .references(() => places.id),
  distanceM: integer('distance_m').notNull(),
  minutes: integer('minutes').notNull(),
  accessible: boolean('accessible').notNull().default(true), // step-free, wheelchair-friendly
  path: jsonb('path').$type<[number, number][]>().notNull(),
  steps: jsonb('steps').$type<RouteStep[]>().notNull(),
  isSample: isSample(),
});

// ───────────────────────────── Reviews, events, audit ─────────────────────────────

export const reviews = pgTable('reviews', {
  id: id(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  serviceId: uuid('service_id').references(() => services.id),
  bookingId: uuid('booking_id').references(() => bookings.id),
  orderId: uuid('order_id').references(() => orders.id),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providers.id),
  rating: integer('rating').notNull(), // 1–5
  text: text('text'),
  language: languageEnum('language').notNull(),
  reply: text('reply'),
  isSample: isSample(),
  createdAt: createdAt(),
});

/** Every status change on any entity writes one row here (AI_RULES.md). */
export const statusEvents = pgTable(
  'status_events',
  {
    id: id(),
    entityType: text('entity_type').notNull(), // booking | order | bag | lost_alert | provider | payment | payout
    entityId: uuid('entity_id').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actorId: uuid('actor_id'),
    reason: text('reason'),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('status_events_entity_idx').on(t.entityType, t.entityId, t.at)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    data: jsonb('data'),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('audit_actor_idx').on(t.actorId, t.at)],
);

// ───────────────────────────── Messages and jobs ─────────────────────────────

/**
 * Every SMS, push and email goes through this outbox. In demo mode nothing is sent;
 * the admin panel shows the outbox so the demo can show "the SMS went to the leader".
 */
export const outboxMessages = pgTable(
  'outbox_messages',
  {
    id: id(),
    channel: text('channel').notNull(), // sms | push | email
    toUserId: uuid('to_user_id').references(() => users.id),
    toAddress: text('to_address'), // phone or email when there is no user
    template: text('template').notNull(), // e.g. booking.accepted, lost_alert.opened
    body: text('body').notNull(), // rendered in the recipient's language
    data: jsonb('data'), // deep link etc.
    status: text('status').notNull().default('queued'), // queued | sent | simulated | failed
    createdAt: createdAt(),
  },
  (t) => [index('outbox_user_idx').on(t.toUserId, t.createdAt)],
);

export const reconciliationRuns = pgTable('reconciliation_runs', {
  id: id(),
  runAt: ts('run_at').notNull().defaultNow(),
  checked: integer('checked').notNull(),
  mismatches: jsonb('mismatches').$type<{ kind: string; id: string; problem: string }[]>().notNull(),
});

/** Files people upload (provider documents). Stored encrypted on disk; only the uploader and admins can read them. */
export const uploads = pgTable('uploads', {
  id: id(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: createdAt(),
});

/** Admin-managed content: home banners and offers, help articles. */
export const contentItems = pgTable('content_items', {
  id: id(),
  kind: text('kind').notNull(), // banner | help
  title: tr('title').notNull(),
  body: tr('body'),
  link: text('link'), // deep link, e.g. rafeeq://services?category=luggage
  city: cityEnum('city'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  isSample: isSample(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ───────────────────────────── Relations (for relational queries) ─────────────────────────────

export const providersRelations = relations(providers, ({ one, many }) => ({
  owner: one(users, { fields: [providers.ownerId], references: [users.id] }),
  services: many(services),
  products: many(products),
  staff: many(staffMembers),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  provider: one(providers, { fields: [services.providerId], references: [providers.id] }),
  slots: many(availabilitySlots),
}));

export const slotsRelations = relations(availabilitySlots, ({ one }) => ({
  service: one(services, { fields: [availabilitySlots.serviceId], references: [services.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  pilgrim: one(users, { fields: [bookings.pilgrimId], references: [users.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  slot: one(availabilitySlots, { fields: [bookings.slotId], references: [availabilitySlots.id] }),
  assignedStaff: one(staffMembers, { fields: [bookings.assignedStaffId], references: [staffMembers.id] }),
  bags: many(bags),
}));

export const staffRelations = relations(staffMembers, ({ one }) => ({
  user: one(users, { fields: [staffMembers.userId], references: [users.id] }),
  provider: one(providers, { fields: [staffMembers.providerId], references: [providers.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  shop: one(providers, { fields: [orders.shopId], references: [providers.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const bagsRelations = relations(bags, ({ one, many }) => ({
  booking: one(bookings, { fields: [bags.bookingId], references: [bookings.id] }),
  scans: many(bagScans),
}));

export const bagScansRelations = relations(bagScans, ({ one }) => ({
  bag: one(bags, { fields: [bagScans.bagId], references: [bags.id] }),
}));

export const groupsRelations = relations(travelGroups, ({ many }) => ({
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(travelGroups, { fields: [groupMembers.groupId], references: [travelGroups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));
