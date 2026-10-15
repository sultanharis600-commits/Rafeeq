import 'server-only';
import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';

/** What every form action returns; the form shows `error` translated by code. */
export type ActionState = { ok: boolean; error?: { code: string; message: string }; data?: unknown } | null;

/** Run an API call for a form; turn API errors into state instead of crashing the page. */
export async function run(fn: () => Promise<unknown>, revalidate?: string | string[]): Promise<ActionState> {
  try {
    const data = await fn();
    for (const p of [revalidate ?? []].flat()) revalidatePath(p, 'layout');
    return { ok: true, data: data ?? null };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
export const num = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === undefined ? undefined : Number(v);
};
export const bool = (f: FormData, k: string) => f.get(k) === 'on' || f.get(k) === 'true';
export const list = (f: FormData, k: string) => f.getAll(k).filter((v): v is string => typeof v === 'string' && v !== '');

/** Translated fields named `title.en`, `title.ar`, … */
export function translated(f: FormData, k: string) {
  const out: Record<string, string> = {};
  for (const lang of ['en', 'ar', 'ur', 'id', 'ms', 'tr']) {
    const v = str(f, `${k}.${lang}`);
    if (v) out[lang] = v;
  }
  return out.en ? (out as { en: string }) : undefined;
}
