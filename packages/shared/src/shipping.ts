import { assertHalalas } from './money';

/**
 * Shipping prices for the gifts shop, by weight and country zone (guide: Shipping prices).
 * A simple table until the courier's rate API is connected. Amounts in halalas.
 */
export const SHIPPING_ZONES = {
  gcc: { countries: ['AE', 'BH', 'KW', 'OM', 'QA'], baseHalalas: 3500, perHalfKgHalalas: 800, days: 4 },
  asia: { countries: ['ID', 'MY', 'PK', 'IN', 'BD', 'SG', 'BN', 'TH', 'PH', 'LK'], baseHalalas: 6000, perHalfKgHalalas: 1500, days: 8 },
  middle_east_africa: { countries: ['EG', 'JO', 'MA', 'DZ', 'TN', 'NG', 'SN', 'SD', 'IQ', 'LB'], baseHalalas: 5500, perHalfKgHalalas: 1300, days: 7 },
  europe_americas: { countries: ['GB', 'TR', 'FR', 'DE', 'NL', 'US', 'CA', 'BE', 'SE', 'IT', 'ES'], baseHalalas: 7500, perHalfKgHalalas: 2000, days: 9 },
} as const;
export type ShippingZone = keyof typeof SHIPPING_ZONES;

export function zoneFor(country: string): ShippingZone | null {
  const c = country.toUpperCase();
  for (const [zone, z] of Object.entries(SHIPPING_ZONES)) {
    if ((z.countries as readonly string[]).includes(c)) return zone as ShippingZone;
  }
  return null;
}

/** Packaging adds 10% to the weight, rounded up to the next half kilo; the first half kilo is in the base price. */
export function internationalShipping(country: string, weightGrams: number): { halalas: number; days: number } | null {
  assertHalalas(weightGrams, 'weightGrams');
  const zone = zoneFor(country);
  if (!zone) return null;
  const z = SHIPPING_ZONES[zone];
  const halfKilos = Math.max(1, Math.ceil((weightGrams * 1.1) / 500));
  return { halalas: z.baseHalalas + (halfKilos - 1) * z.perHalfKgHalalas, days: z.days };
}

/** Hotel delivery: free in the shop's city, a flat fee to the other holy city. */
export const HOTEL_DELIVERY_OTHER_CITY_HALALAS = 2500;
export const HOTEL_DELIVERY_DAYS = { sameCity: 1, otherCity: 2 } as const;
export const GIFT_WRAP_HALALAS = 1000;
