import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Language } from '@rafeeq/shared';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { otpCodes, users } from '../db/schema.js';
import { AppError, badRequest } from '../common/errors.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;
const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.config.get('JWT_SECRET', { infer: true })).update(`${phone}:${code}`).digest('hex');
  }

  get demoMode(): boolean {
    return this.config.get('DEMO_MODE', { infer: true });
  }

  /** Send a one-time code by SMS. In demo mode the code is always DEMO_OTP_CODE and nothing is sent. */
  async requestOtp(phone: string, language: Language = 'en'): Promise<{ expiresInSeconds: number; demoCode?: string }> {
    if (!E164.test(phone)) throw badRequest('auth.invalid_phone', 'Phone must be in international format, e.g. +966501234567');

    const [{ recent }] = await this.db
      .select({ recent: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, new Date(Date.now() - 3600_000))));
    if (recent >= OTP_MAX_PER_HOUR) {
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'auth.too_many_codes', 'Too many codes requested. Try again in an hour.');
    }

    const code = this.demoMode ? this.config.get('DEMO_OTP_CODE', { infer: true }) : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.insert(otpCodes).values({
      phone,
      codeHash: this.hash(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    });
    const [existing] = await this.db.select({ language: users.language }).from(users).where(eq(users.phone, phone)).limit(1);
    await this.notifications.smsToPhone(phone, 'auth.otp', existing?.language ?? language, { code });

    return { expiresInSeconds: OTP_TTL_MINUTES * 60, ...(this.demoMode ? { demoCode: code } : {}) };
  }

  /** Check the code; create a pilgrim account on first login. Returns a bearer token. */
  async verifyOtp(input: { phone: string; code: string; name?: string; language?: Language }) {
    const { phone, code } = input;
    const [otp] = await this.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (!otp) throw badRequest('auth.code_expired', 'Code expired. Request a new one.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'auth.locked', 'Too many wrong codes. Request a new code later.');
    }

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hash(phone, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await this.db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
      throw badRequest('auth.wrong_code', 'Wrong code', { attemptsLeft: OTP_MAX_ATTEMPTS - otp.attempts - 1 });
    }
    await this.db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

    let [user] = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    const isNew = !user;
    if (!user) {
      [user] = await this.db
        .insert(users)
        .values({ phone, name: input.name?.trim() || 'Pilgrim', language: input.language ?? 'en', role: 'pilgrim' })
        .returning();
    }
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, isNew, user: { id: user.id, name: user.name, role: user.role, language: user.language } };
  }

  get quickLoginEnabled(): boolean {
    return this.config.get('QUICK_LOGIN', { infer: true });
  }

  /**
   * TESTING ONLY. Log in with just a phone number or email, no code. Works only while
   * QUICK_LOGIN is on, which the config refuses without DEMO_MODE. An unknown phone or
   * email creates a new pilgrim account (a new email gets a placeholder +999 phone).
   */
  async quickLogin(input: { identifier: string; name?: string; language?: Language }) {
    if (!this.quickLoginEnabled) {
      throw new AppError(HttpStatus.FORBIDDEN, 'auth.quick_login_off', 'Quick login is only for testing. Log in with a code.');
    }
    const raw = input.identifier.trim();
    const email = raw.includes('@') ? raw.toLowerCase() : null;
    const phone = email ? null : raw.replace(/[\s()-]/g, '');
    if (email && !EMAIL.test(email)) throw badRequest('auth.invalid_email', 'Enter a valid email address');
    if (phone && !E164.test(phone)) throw badRequest('auth.invalid_phone', 'Phone must be in international format, e.g. +966501234567');

    let [user] = await this.db
      .select()
      .from(users)
      .where(email ? eq(users.email, email) : eq(users.phone, phone!))
      .limit(1);
    const isNew = !user;
    if (!user) {
      // A new email account still needs a unique phone; +999 is not a real country code.
      const digits = BigInt('0x' + createHash('sha256').update(email ?? '').digest('hex').slice(0, 14)).toString().slice(-11).padStart(11, '0');
      [user] = await this.db
        .insert(users)
        .values({
          phone: phone ?? `+999${digits}`,
          email,
          name: input.name?.trim() || (email ? email.split('@')[0] : 'Pilgrim'),
          language: input.language ?? 'en',
          role: 'pilgrim',
        })
        .returning();
    }
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, isNew, user: { id: user.id, name: user.name, role: user.role, language: user.language } };
  }
}
