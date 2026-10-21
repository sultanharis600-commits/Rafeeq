/**
 * Rafeeq design tokens. The web CSS (apps/web/src/app/globals.css) and the Flutter
 * theme (apps/mobile/lib/src/theme.dart) use these same values; change all three together.
 * Colours follow the Saudi national design system, DGA Platforms Code: SA flag green,
 * gold and cool neutrals on white, with a terracotta accent for alerts. The `sand` names
 * are kept for the neutral greys. Layout rule: no boxed cards; content sits on white,
 * separated by space and hairlines. Motifs: the eight-point star (khatim) and the Sadu band.
 * Type: IBM Plex Sans Arabic (as in Platforms Code) with Inter for Latin.
 */
export const colors = {
  brand950: '#092A1E',
  brand900: '#104631',
  brand800: '#14573A',
  brand700: '#1B8354', // SA flag green, Platforms Code primary
  brand500: '#25935F',
  brand300: '#88D8AD',
  brand100: '#DFF6E7',
  brand50: '#F3FCF6',
  sand50: '#FFFFFF',
  sand100: '#F9FAFB',
  sand200: '#F3F4F6',
  sand300: '#D2D6DB',
  gold300: '#F7D54D',
  gold500: '#DBA102', // Platforms Code gold
  gold700: '#945C01',
  clay500: '#B8562F',
  clay700: '#8A3D1F',
  clay100: '#F8E6DC',
  lavender500: '#80519F', // Platforms Code tertiary
  ink900: '#1F2A37',
  ink600: '#4D5761',
} as const;

export const fonts = {
  latin: 'Inter',
  arabic: 'IBM Plex Sans Arabic',
  display: 'IBM Plex Sans Arabic',
} as const;

/** Accessibility minimums from the spec. */
export const accessibility = {
  minBodyTextPx: 16,
  minTouchTargetPx: 48,
} as const;
