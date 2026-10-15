import 'server-only';
import { cookies } from 'next/headers';

/**
 * Server-side API client. The bearer token lives in an httpOnly cookie and never reaches
 * browser JavaScript. All calls go to the NestJS API (`API_URL`).
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const TOKEN_COOKIE = 'rafeeq_token';
export const PROVIDER_COOKIE = 'rafeeq_provider';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function token(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

type Options = { method?: string; body?: unknown; auth?: boolean; query?: Record<string, string | number | boolean | undefined> };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const t = await token();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const qs = opts.query
    ? '?' +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${API_URL}/v1${path}${qs}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? `http.${res.status}`, Array.isArray(data?.message) ? data.message.join('; ') : (data?.message ?? res.statusText), data?.details);
  }
  return data as T;
}

/** Fetch a binary (e.g. invoice PDF) with the session token. */
export async function apiRaw(path: string): Promise<Response> {
  const t = await token();
  return fetch(`${API_URL}/v1${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: 'no-store' });
}

export type Page<T> = { items: T[]; limit: number; offset: number; hasMore: boolean };

/** Upload a file the user picked in a form; returns the upload://… reference. */
export async function uploadFile(file: File): Promise<string> {
  const t = await token();
  const body = new FormData();
  body.append('file', file, file.name);
  const res = await fetch(`${API_URL}/v1/uploads`, { method: 'POST', headers: t ? { Authorization: `Bearer ${t}` } : {}, body });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data?.code ?? `http.${res.status}`, data?.message ?? res.statusText);
  return data.ref as string;
}
