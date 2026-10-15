import { defineRouting } from 'next-intl/routing';

/** The web tools (provider dashboard, admin panel) are Arabic and English. */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
});

export const RTL_LOCALES = new Set(['ar']);
