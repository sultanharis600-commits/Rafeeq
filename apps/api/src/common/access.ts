import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import { forbidden } from './errors.js';

/**
 * Permission checks shared by every module. A pilgrim never sees another pilgrim's
 * data; providers see only their own; staff see what their provider assigned them.
 */
export function ownsProvider(user: AuthUser, providerId: string): boolean {
  return user.providerIds.includes(providerId);
}

export function worksFor(user: AuthUser, providerId: string): boolean {
  return user.staff.some((s) => s.providerId === providerId);
}

/** Owner of the provider, or an admin. */
export function assertProviderManager(user: AuthUser, providerId: string): void {
  if (!ownsProvider(user, providerId) && !isAdmin(user)) throw forbidden('provider.not_yours', 'Not your provider account');
}

/** Owner, staff of the provider, or an admin. */
export function assertProviderMember(user: AuthUser, providerId: string): void {
  if (!ownsProvider(user, providerId) && !worksFor(user, providerId) && !isAdmin(user)) {
    throw forbidden('provider.not_yours', 'Not your provider account');
  }
}

/** Providers the user can act for (owned or staff). */
export function memberProviderIds(user: AuthUser): string[] {
  return [...new Set([...user.providerIds, ...user.staff.map((s) => s.providerId)])];
}
