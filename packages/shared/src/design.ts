/**
 * Rafeeq design tokens. The web CSS (apps/web/src/app/globals.css) and the Flutter
 * theme (apps/mobile/lib/src/theme.dart) use these same values; change all three together.
 * Branding from the spec: deep green/teal, sand and gold accents,
 * IBM Plex Sans Arabic with Inter.
 */
export const colors = {
  brand900: '#063d3a',
  brand700: '#0b5d57',
  brand500: '#128c7e',
  brand100: '#d7efeb',
  sand100: '#f7f1e6',
  sand300: '#e8dcc4',
  gold500: '#c9a227',
  ink900: '#1c2421',
  ink600: '#4b5754',
} as const;

export const fonts = {
  latin: 'Inter',
  arabic: 'IBM Plex Sans Arabic',
} as const;

/** Accessibility minimums from the spec. */
export const accessibility = {
  minBodyTextPx: 16,
  minTouchTargetPx: 48,
} as const;
