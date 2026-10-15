/** Launch languages. Arabic and Urdu are right-to-left. */
export const LANGUAGES = ['ar', 'en', 'ur', 'id', 'ms', 'tr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const RTL_LANGUAGES: readonly Language[] = ['ar', 'ur'];

/** Text stored once per language. */
export type Translated = Partial<Record<Language, string>> & { en: string };

export const ROLES = ['pilgrim', 'provider_owner', 'staff', 'admin_ops', 'admin_finance', 'admin_support'] as const;
export type Role = (typeof ROLES)[number];
export const ADMIN_ROLES: readonly Role[] = ['admin_ops', 'admin_finance', 'admin_support'];

export const SERVICE_CATEGORIES = [
  'transport',
  'guides',
  'photography',
  'luggage',
  'accessibility',
  'heritage_tours',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const PRODUCT_SECTIONS = ['makkah_gifts', 'madinah_gifts', 'dates'] as const;
export type ProductSection = (typeof PRODUCT_SECTIONS)[number];

export const PLACE_TYPES = ['holy_site', 'shopping', 'gate', 'lost_and_found', 'gathering_point', 'hotel', 'toilet'] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const CITIES = ['makkah', 'madinah'] as const;
export type City = (typeof CITIES)[number];

/** Saudi time zone used for display. Storage is always UTC. */
export const DISPLAY_TIME_ZONE = 'Asia/Riyadh';
