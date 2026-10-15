import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@rafeeq/shared';
import { AppError, forbidden } from '../common/errors.js';
import { HttpStatus } from '@nestjs/common';
import { IS_PUBLIC, ROLES } from './auth-user.js';
import { AuthUsersService } from './auth-users.service.js';

/** Global guard: every endpoint needs a valid token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthUsersService) private readonly users: AuthUsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new AppError(HttpStatus.UNAUTHORIZED, 'auth.missing_token', 'Login required');
    }
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      if (isPublic) return true;
      throw new AppError(HttpStatus.UNAUTHORIZED, 'auth.invalid_token', 'Login expired or invalid');
    }
    const user = await this.users.load(sub);
    if (!user) throw new AppError(HttpStatus.UNAUTHORIZED, 'auth.invalid_token', 'User no longer exists');
    req.user = user;
    return true;
  }
}

/** Global guard: enforces @Roles(...) when present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw forbidden('auth.role_required', `Requires role: ${roles.join(', ')}`);
    return true;
  }
}
