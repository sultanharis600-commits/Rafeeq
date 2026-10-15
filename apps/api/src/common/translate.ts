import type { Language, Translated } from '@rafeeq/shared';

/** Pick the user's language, falling back to English. Never machine-translates (AI_RULES.md). */
export function pick(t: Translated | null | undefined, lang: Language | string): string {
  if (!t) return '';
  return (t as Record<string, string | undefined>)[lang] ?? t.en;
}
