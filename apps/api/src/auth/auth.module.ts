import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthUsersService } from './auth-users.service.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, RolesGuard } from './guards.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_TTL', { infer: true }) as `${number}d` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthUsersService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthUsersService],
})
export class AuthModule {}
