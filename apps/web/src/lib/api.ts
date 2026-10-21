import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setDefaultResultOrder } from 'node:dns';
import { cookies } from 'next/headers';

// Windows/Node resolve localhost to IPv6 first; the API listens on IPv4 too.
setDefaultResultOrder('ipv4first');

/**
 * Server-side API client. The bearer token lives in an httpOnly cookie and never reaches
 * browser JavaScript. All calls go to the NestJS API (`API_URL`).
 */
export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';
export const TOKEN_COOKIE = 'rafeeq_token';
export const PROVIDER_COOKIE = 'rafeeq_provider';

/** Login UI is skipped: dashboards use these demo accounts when no cookie is set. */
export const SKIP_LOGIN = true;
export const DEMO_PROVIDER_LOGIN = 'owner-transport@rafeeq.test';
export const DEMO_ADMIN_LOGIN = 'admin-ops@rafeeq.test';

const demoAuth = new AsyncLocalStorage<string>();
const demoTokenCache = new Map<string, string>();
let lastIssuedDemoToken: string | undefined;

async function request(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (attempt < 4 && (code === 'ECONNREFUSED' || code === 'UND_ERR_SOCKET')) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return request(url, init, attempt + 1);
    }
    throw err;
  }
}

export async function demoToken(identifier: string): Promise<string> {
  const hit = demoTokenCache.get(identifier);
  if (hit) {
    lastIssuedDemoToken = hit;
    return hit;
  }
  const res = await request(`${API_URL}/v1/auth/quick-login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? `http.${res.status}`, Array.isArray(data?.message) ? data.message.join('; ') : (data?.message ?? res.statusText), data?.details);
  }
  lastIssuedDemoToken = data.token as string;
  demoTokenCache.set(identifier, lastIssuedDemoToken);
  return lastIssuedDemoToken;
}

export function runWithDemoToken<T>(tokenValue: string, fn: () => Promise<T>): Promise<T> {
  return demoAuth.run(tokenValue, fn);
}

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

export async function cookieToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

export async function token(): Promise<string | undefined> {
  return (await cookieToken()) ?? demoAuth.getStore() ?? lastIssuedDemoToken;
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
  const res = await request(`${API_URL}/v1${path}${qs}`, {
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
