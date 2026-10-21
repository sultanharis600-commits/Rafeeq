import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, cookieToken, DEMO_ADMIN_LOGIN, DEMO_PROVIDER_LOGIN, demoToken, PROVIDER_COOKIE, runWithDemoToken, SKIP_LOGIN } from './api';
import type { Me, Provider } from './types';

export const ADMIN_ROLES = ['admin_ops', 'admin_finance', 'admin_support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Load /me. Login redirects are commented out; without a cookie we use a demo account. */
async function withSession<T>(locale: string, identifier: string, fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    try {
      return await fn();
    } catch (e) {
      // if (e instanceof ApiError && e.status === 401) redirect(`/${locale}/login?expired=1`);
      if (!SKIP_LOGIN && e instanceof ApiError && e.status === 401) redirect(`/${locale}/login?expired=1`);
      throw e;
    }
  };
  if (await cookieToken()) return run();
  // if (!(await token())) redirect(`/${locale}/login`);
  if (!SKIP_LOGIN) redirect(`/${locale}/login`);
  const t = await demoToken(identifier);
  return runWithDemoToken(t, run);
}

export async function requireMe(locale: string): Promise<Me> {
  return withSession(locale, DEMO_PROVIDER_LOGIN, () => api<Me>('/me'));
}

export async function requireAdmin(locale: string): Promise<Me & { role: AdminRole }> {
  return withSession(locale, DEMO_ADMIN_LOGIN, async () => {
    const me = await api<Me>('/me');
    if (!(ADMIN_ROLES as readonly string[]).includes(me.role)) redirect(`/${locale}`);
    return me as Me & { role: AdminRole };
  });
}

/** The provider being managed (owners can have more than one), chosen with the switcher. */
export async function requireProvider(locale: string): Promise<{ me: Me; providers: Provider[]; current: Provider | null }> {
  return withSession(locale, DEMO_PROVIDER_LOGIN, async () => {
    const me = await api<Me>('/me');
    if (me.role !== 'provider_owner' && me.role !== 'pilgrim') redirect(`/${locale}`);
    const providers = me.role === 'provider_owner' ? await api<Provider[]>('/providers/mine') : [];
    const chosen = (await cookies()).get(PROVIDER_COOKIE)?.value;
    const current = providers.find((p) => p.id === chosen) ?? providers[0] ?? null;
    return { me, providers, current };
  });
}
