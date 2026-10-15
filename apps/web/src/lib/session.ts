import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, PROVIDER_COOKIE, token } from './api';
import type { Me, Provider } from './types';

export const ADMIN_ROLES = ['admin_ops', 'admin_finance', 'admin_support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** The logged-in user, or a redirect to the login page. */
export async function requireMe(locale: string): Promise<Me> {
  if (!(await token())) redirect(`/${locale}/login`);
  try {
    return await api<Me>('/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(`/${locale}/login?expired=1`);
    throw e;
  }
}

export async function requireAdmin(locale: string): Promise<Me & { role: AdminRole }> {
  const me = await requireMe(locale);
  if (!(ADMIN_ROLES as readonly string[]).includes(me.role)) redirect(`/${locale}`);
  return me as Me & { role: AdminRole };
}

/** The provider being managed (owners can have more than one), chosen with the switcher. */
export async function requireProvider(locale: string): Promise<{ me: Me; providers: Provider[]; current: Provider | null }> {
  const me = await requireMe(locale);
  if (me.role !== 'provider_owner' && me.role !== 'pilgrim') redirect(`/${locale}`);
  const providers = me.role === 'provider_owner' ? await api<Provider[]>('/providers/mine') : [];
  const chosen = (await cookies()).get(PROVIDER_COOKIE)?.value;
  const current = providers.find((p) => p.id === chosen) ?? providers[0] ?? null;
  return { me, providers, current };
}
