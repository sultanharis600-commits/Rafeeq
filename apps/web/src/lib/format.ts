import type { Translated } from './types';

const LOCALES: Record<string, string> = { ar: 'ar-SA', en: 'en-GB' };

/** Money is integer halalas; shown as SAR in the reader's locale. */
export function sar(halalas: number, locale: string): string {
  return new Intl.NumberFormat(LOCALES[locale] ?? 'en-GB', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(halalas / 100);
}

/** Times are stored in UTC and always shown in Saudi time. */
export function when(iso: string | Date | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(LOCALES[locale] ?? 'en-GB', { timeZone: 'Asia/Riyadh', ...opts }).format(new Date(iso));
}

export function day(iso: string | Date | null | undefined, locale: string): string {
  return when(iso, locale, { dateStyle: 'medium' });
}

export function pick(t: Translated | null | undefined, locale: string): string {
  if (!t) return '';
  return (t as Record<string, string | undefined>)[locale] ?? t.en;
}

export function percent(bps: number, locale: string): string {
  return new Intl.NumberFormat(LOCALES[locale] ?? 'en-GB', { style: 'percent', maximumFractionDigits: 2 }).format(bps / 10000);
}

/** "2026-10-14" for today in Saudi time, for date inputs. */
export function saudiToday(offsetDays = 0): string {
  return new Date(Date.now() + 3 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

/** Parse "350.00" into halalas without floating-point errors. */
export function toHalalas(sarText: string): number {
  const m = /^\s*(\d+)(?:[.,](\d{1,2}))?\s*$/.exec(sarText);
  if (!m) return NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

export function fromHalalas(h: number): string {
  return `${Math.floor(h / 100)}.${String(h % 100).padStart(2, '0')}`;
}

/** True when the time is in the past (server components render once per request). */
export function isPast(iso: string | null | undefined): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() < Date.now();
}
