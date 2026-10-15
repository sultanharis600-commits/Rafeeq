import { assertHalalas } from './money';

export const PRICE_MODELS = ['per_trip', 'per_hour', 'per_person', 'per_bag', 'per_tag', 'fixed'] as const;
export type PriceModel = (typeof PRICE_MODELS)[number];

/**
 * How many units of slot capacity a booking uses. Capacity counts people, bags or tags
 * for those price models; otherwise it counts vehicles/staff, and one booking uses one.
 */
export function slotUnits(priceModel: PriceModel, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`quantity must be a positive integer, got ${quantity}`);
  return priceModel === 'per_bag' || priceModel === 'per_person' || priceModel === 'per_tag' ? quantity : 1;
}

/**
 * Booking total in halalas: (unit price + chosen options) × quantity.
 * Quantity means hours for per_hour, bags for per_bag, people for per_person, tags for per_tag;
 * it must be 1 for per_trip and fixed.
 */
export function bookingTotal(
  priceModel: PriceModel,
  unitPriceHalalas: number,
  quantity: number,
  optionPricesHalalas: readonly number[] = [],
): number {
  assertHalalas(unitPriceHalalas, 'unitPrice');
  optionPricesHalalas.forEach((p) => assertHalalas(p, 'optionPrice'));
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`quantity must be a positive integer, got ${quantity}`);
  if ((priceModel === 'per_trip' || priceModel === 'fixed') && quantity !== 1) {
    throw new Error(`quantity must be 1 for ${priceModel}`);
  }
  const perUnit = unitPriceHalalas + optionPricesHalalas.reduce((a, b) => a + b, 0);
  return perUnit * quantity;
}

export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

/**
 * Refund (in halalas) when the pilgrim cancels, by the service's policy and how long
 * before the start they cancel. Provider-side cancellations and declines always refund in full.
 *   flexible: 100% until 24 h before, then 50%
 *   moderate: 100% until 48 h before, 50% until 24 h, then 0
 *   strict:   50% until 7 days before, then 0
 * Half refunds round down to the halala, in the pilgrim's disfavour by at most 1 halala.
 */
export function refundFor(policy: CancellationPolicy, hoursBeforeStart: number, paidHalalas: number): number {
  assertHalalas(paidHalalas, 'paid');
  const half = Math.floor(paidHalalas / 2);
  if (hoursBeforeStart <= 0) return 0; // after the start: no automatic refund (dispute instead)
  switch (policy) {
    case 'flexible':
      return hoursBeforeStart >= 24 ? paidHalalas : half;
    case 'moderate':
      return hoursBeforeStart >= 48 ? paidHalalas : hoursBeforeStart >= 24 ? half : 0;
    case 'strict':
      return hoursBeforeStart >= 24 * 7 ? half : 0;
  }
}

/** Minutes a slot's capacity is held while the pilgrim pays. */
export const PAYMENT_HOLD_MINUTES = 10;
/** Minutes a provider has to accept a paid booking before it is declined and refunded. */
export const PROVIDER_ACCEPT_MINUTES = 30;
