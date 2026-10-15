/**
 * Status machines from the guide. The API refuses any transition not listed here
 * and writes a status_events row for every transition it accepts.
 */

export const BOOKING_STATUSES = [
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
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['accepted', 'declined', 'cancelled'],
  accepted: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['completed', 'disputed'],
  completed: ['paid_out', 'disputed'],
  paid_out: [],
  declined: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
  disputed: ['completed', 'refunded'],
};

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'packed',
  'out_for_delivery',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled'],
  packed: ['out_for_delivery', 'shipped', 'cancelled'],
  out_for_delivery: ['delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: ['refunded'],
  refunded: [],
};

export const BAG_STATUSES = ['tagged', 'in_transit', 'stored', 'delivered', 'overdue', 'lost', 'found'] as const;
export type BagStatus = (typeof BAG_STATUSES)[number];

export const PROVIDER_STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return table[from]?.includes(to) ?? false;
}
