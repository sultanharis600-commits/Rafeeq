import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Language, Role } from '@rafeeq/shared';

/** Who is calling, loaded fresh from the database on every request. */
export interface AuthUser {
  id: string;
  role: Role;
  language: Language;
  name: string;
  /** Providers this user owns (role provider_owner). */
  providerIds: string[];
  /** Staff memberships (role staff). */
  staff: { id: string; providerId: string; staffRole: string }[];
}

export const IS_PUBLIC = 'isPublic';
/** Endpoint needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Endpoint is limited to these roles. Admin roles are listed explicitly. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const ADMIN: Role[] = ['admin_ops', 'admin_finance', 'admin_support'];

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const isAdmin = (u: AuthUser) => ADMIN.includes(u.role);
