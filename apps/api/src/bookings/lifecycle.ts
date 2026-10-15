import { eq, sql } from 'drizzle-orm';
import { BOOKING_TRANSITIONS, slotUnits, type BookingStatus, type PriceModel } from '@rafeeq/shared';
import type { Tx } from '../db/client.js';
import { availabilitySlots, bookings, services } from '../db/schema.js';
import { notFound } from '../common/errors.js';
import { assertTransition, recordStatus } from '../common/status.js';

/**
 * Booking state changes, as plain functions so payments, jobs and the bookings
 * service share one implementation. Every change checks the status machine and
 * writes a status_events row.
 */
export type BookingRow = typeof bookings.$inferSelect;

export async function lockBooking(tx: Tx, id: string): Promise<BookingRow> {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update');
  if (!b) throw notFound('booking');
  return b;
}

export async function transitionBooking(
  tx: Tx,
  b: BookingRow,
  to: BookingStatus,
  opts: { actorId?: string | null; reason?: string; set?: Partial<typeof bookings.$inferInsert> } = {},
): Promise<BookingRow> {
  assertTransition('booking', BOOKING_TRANSITIONS, b.status, to);
  const [row] = await tx
    .update(bookings)
    .set({ status: to, ...opts.set })
    .where(eq(bookings.id, b.id))
    .returning();
  await recordStatus(tx, { entityType: 'booking', entityId: b.id, from: b.status, to, actorId: opts.actorId, reason: opts.reason });
  return row;
}

async function units(tx: Tx, b: BookingRow): Promise<number> {
  const [s] = await tx.select({ priceModel: services.priceModel }).from(services).where(eq(services.id, b.serviceId));
  return slotUnits(s.priceModel as PriceModel, b.quantity);
}

/** Payment succeeded: the held capacity becomes booked. */
export async function convertHoldToBooked(tx: Tx, b: BookingRow): Promise<void> {
  if (!b.slotId) return;
  const n = await units(tx, b);
  await tx
    .update(availabilitySlots)
    .set({ held: sql`greatest(${availabilitySlots.held} - ${n}, 0)`, booked: sql`${availabilitySlots.booked} + ${n}` })
    .where(eq(availabilitySlots.id, b.slotId));
}

/** Give capacity back to the slot (cancelled, declined, refunded, hold expired). */
export async function releaseCapacity(tx: Tx, b: BookingRow, from: 'held' | 'booked'): Promise<void> {
  if (!b.slotId) return;
  const n = await units(tx, b);
  const col = from === 'held' ? availabilitySlots.held : availabilitySlots.booked;
  await tx
    .update(availabilitySlots)
    .set({ [from]: sql`greatest(${col} - ${n}, 0)` })
    .where(eq(availabilitySlots.id, b.slotId));
}

/** Statuses where the slot's capacity counts the booking as booked. */
export const HOLDS_BOOKED_CAPACITY: BookingStatus[] = ['paid', 'accepted', 'in_progress', 'completed', 'paid_out', 'disputed'];
