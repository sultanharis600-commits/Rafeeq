import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import type { Language } from '@rafeeq/shared';
import type { Env } from '../config/env.js';
import type { Database, Tx } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { outboxMessages, users } from '../db/schema.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { render, type Params, type TemplateKey } from './templates.js';

export type Channel = 'push' | 'sms';

/**
 * Sends push and SMS through the outbox. In demo mode messages are stored as
 * "simulated" and never leave the server; the admin panel shows them.
 * Real SMS and push providers plug in at `deliver()` after the MVP.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  /** Notify users in their own language. Pass `tx` to write inside an open transaction. */
  async toUsers(
    userIds: string[],
    template: TemplateKey,
    params: Params,
    opts: { channel?: Channel; data?: Record<string, unknown>; tx?: Tx } = {},
  ): Promise<void> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;
    const db = opts.tx ?? this.db;
    const rows = await db
      .select({ id: users.id, language: users.language, phone: users.phone })
      .from(users)
      .where(inArray(users.id, ids));
    const channel = opts.channel ?? 'push';
    const status = this.config.get('DEMO_MODE', { infer: true }) ? 'simulated' : 'queued';
    const values = rows.map((u) => ({
      channel,
      toUserId: u.id,
      toAddress: channel === 'sms' ? u.phone : null,
      template,
      body: render(template, u.language, params),
      data: opts.data,
      status,
    }));
    await db.insert(outboxMessages).values(values);
    for (const v of values) {
      this.realtime.emit(`user:${v.toUserId}`, 'notification', { template, body: v.body, data: v.data });
    }
  }

  /** SMS to a phone number that may not belong to a Rafeeq user (emergency contacts, OTP). */
  async smsToPhone(phone: string, template: TemplateKey, lang: Language, params: Params, tx?: Tx) {
    const status = this.config.get('DEMO_MODE', { infer: true }) ? 'simulated' : 'queued';
    const db = tx ?? this.db;
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    await db.insert(outboxMessages).values({
      channel: 'sms',
      toUserId: existing?.id ?? null,
      toAddress: phone,
      template,
      // OTP codes are never stored in plain text outside demo mode (where the code is the public test code).
      body: template === 'auth.otp' && status !== 'simulated' ? render(template, lang, { ...params, code: '••••••' }) : render(template, lang, params),
      status,
    });
    if (status === 'queued') {
      // TODO(after MVP): hand the rendered text to the chosen Saudi SMS provider here.
      this.log.warn(`SMS provider not configured; ${template} not delivered`);
    }
  }
}
