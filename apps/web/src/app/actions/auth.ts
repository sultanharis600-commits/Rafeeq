'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, PROVIDER_COOKIE, TOKEN_COOKIE } from '@/lib/api';
import type { ActionState } from './common';
import { str } from './common';

export async function requestCode(_: ActionState, form: FormData): Promise<ActionState> {
  const phone = str(form, 'phone') ?? '';
  try {
    const res = await api<{ expiresInSeconds: number; demoCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone }, auth: false });
    return { ok: true, data: { phone, ...res } };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

export async function verifyCode(_: ActionState, form: FormData): Promise<ActionState> {
  const phone = str(form, 'phone') ?? '';
  const code = str(form, 'code') ?? '';
  const locale = str(form, 'locale') ?? 'ar';
  let role: string;
  try {
    const res = await api<{ token: string; user: { role: string } }>('/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false });
    const jar = await cookies();
    jar.set(TOKEN_COOKIE, res.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 3600 });
    jar.delete(PROVIDER_COOKIE);
    role = res.user.role;
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message }, data: { phone } };
    throw e;
  }
  redirect(role.startsWith('admin_') ? `/${locale}/admin` : `/${locale}/provider`);
}

/** Testing only: phone number or email, no code (the API refuses this outside demo mode). */
export async function quickLogin(_: ActionState, form: FormData): Promise<ActionState> {
  const identifier = str(form, 'identifier') ?? '';
  const locale = str(form, 'locale') ?? 'ar';
  let role: string;
  try {
    const res = await api<{ token: string; user: { role: string } }>('/auth/quick-login', { method: 'POST', body: { identifier }, auth: false });
    const jar = await cookies();
    jar.set(TOKEN_COOKIE, res.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 3600 });
    jar.delete(PROVIDER_COOKIE);
    role = res.user.role;
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message }, data: { identifier } };
    throw e;
  }
  redirect(role.startsWith('admin_') ? `/${locale}/admin` : `/${locale}/provider`);
}

export async function logout(locale: string) {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(PROVIDER_COOKIE);
  redirect(`/${locale}/login`);
}

export async function chooseProvider(locale: string, providerId: string) {
  (await cookies()).set(PROVIDER_COOKIE, providerId, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(`/${locale}/provider`);
}
