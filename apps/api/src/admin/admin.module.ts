import { Body, Controller, Get, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { CITIES, commissionSplit, LANGUAGES, type City, type Language } from '@rafeeq/shared';
import { ADMIN, CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import {
  auditLogs,
  bookings,
  contentItems,
  lostAlerts,
  lostBagCases,
  orders,
  outboxMessages,
  payments,
  providers,
  services,
  users,
} from '../db/schema.js';
import { audit } from '../common/audit.js';
import { LongTranslatedDto, TranslatedDto } from '../common/dto.js';
import { notFound } from '../common/errors.js';
import { PageQuery, toPage } from '../common/pagination.js';
import { pick } from '../common/translate.js';

const DAY = 24 * 3600_000;
const PAID = ['paid', 'accepted', 'in_progress', 'completed', 'paid_out', 'disputed'] as const;

@Injectable()
export class AdminService {
  constructor(@InjectDb() private readonly db: Database) {}

  /**
   * Reports (guide: Admin panel): bookings, gross booking value, commission, shop sales,
   * active providers, top nationalities, open bag cases and lost-person alerts.
   * `days` = how far back (default today, Saudi time).
   */
  async overview(days = 1) {
    const saudiMidnight = new Date(Math.floor((Date.now() + 3 * 3600_000) / DAY) * DAY - 3 * 3600_000);
    const since = new Date(saudiMidnight.getTime() - (days - 1) * DAY);

    const bookingRows = await this.db
      .select({ total: bookings.totalHalalas, status: bookings.status, rate: providers.commissionRateBps, freeUntil: providers.commissionFreeUntil, category: services.category })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(providers, eq(providers.id, services.providerId))
      .where(and(gte(bookings.createdAt, since), inArray(bookings.status, [...PAID])));
    const orderRows = await this.db
      .select({ total: orders.totalHalalas, rate: providers.commissionRateBps, freeUntil: providers.commissionFreeUntil })
      .from(orders)
      .innerJoin(providers, eq(providers.id, orders.shopId))
      .where(and(gte(orders.createdAt, since), inArray(orders.status, ['paid', 'packed', 'out_for_delivery', 'shipped', 'delivered'])));
    const commissionOf = (rows: { total: number; rate: number; freeUntil: Date | null }[]) =>
      rows.reduce((s, r) => s + (r.freeUntil && r.freeUntil > new Date() ? 0 : commissionSplit(r.total, r.rate).commission), 0);

    const [refunds] = await this.db
      .select({ refunded: sql<number>`coalesce(sum(${payments.refundedHalalas}),0)::int` })
      .from(payments)
      .where(gte(payments.updatedAt, since));
    const [openCases] = await this.db.select({ n: count() }).from(lostBagCases).where(eq(lostBagCases.status, 'open'));
    const [openAlerts] = await this.db.select({ n: count() }).from(lostAlerts).where(inArray(lostAlerts.status, ['open', 'acknowledged']));
    const [pendingProviders] = await this.db.select({ n: count() }).from(providers).where(eq(providers.status, 'pending'));
    const [activeProviders] = await this.db.select({ n: count() }).from(providers).where(eq(providers.status, 'approved'));
    const [disputes] = await this.db.select({ n: count() }).from(bookings).where(eq(bookings.status, 'disputed'));
    const awaitingAccept = await this.db.select({ n: count() }).from(bookings).where(eq(bookings.status, 'paid'));
    const nationalities = await this.db
      .select({ nationality: users.nationality, n: count() })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.pilgrimId))
      .where(and(gte(bookings.createdAt, new Date(since.getTime() - 29 * DAY)), inArray(bookings.status, [...PAID])))
      .groupBy(users.nationality)
      .orderBy(desc(count()))
      .limit(5);
    const byCategory = new Map<string, number>();
    for (const b of bookingRows) byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);

    return {
      since: since.toISOString(),
      bookings: { count: bookingRows.length, grossHalalas: bookingRows.reduce((s, b) => s + b.total, 0), commissionHalalas: commissionOf(bookingRows), byCategory: Object.fromEntries(byCategory), awaitingAccept: awaitingAccept[0].n, disputes: disputes.n },
      shop: { orders: orderRows.length, salesHalalas: orderRows.reduce((s, o) => s + o.total, 0), commissionHalalas: commissionOf(orderRows) },
      refundsHalalas: refunds.refunded,
      providers: { active: activeProviders.n, pending: pendingProviders.n },
      safety: { openBagCases: openCases.n, openLostAlerts: openAlerts.n },
      topNationalities: nationalities.map((n) => ({ nationality: n.nationality ?? '—', bookings: n.n })),
    };
  }

  async auditLog(q: PageQuery & { actorId?: string }) {
    const rows = await this.db
      .select({ log: auditLogs, actor: users.name, role: users.role })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(q.actorId ? eq(auditLogs.actorId, q.actorId) : undefined)
      .orderBy(desc(auditLogs.at))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(rows, q);
  }

  /** In demo mode every SMS and push lands here instead of being sent. */
  async outbox(q: PageQuery & { channel?: string }) {
    const rows = await this.db
      .select({ m: outboxMessages, to: users.name })
      .from(outboxMessages)
      .leftJoin(users, eq(users.id, outboxMessages.toUserId))
      .where(q.channel ? eq(outboxMessages.channel, q.channel) : undefined)
      .orderBy(desc(outboxMessages.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    // OTP codes are never shown, even in demo mode.
    return toPage(rows.map((r) => ({ ...r.m, to: r.to, body: r.m.template === 'auth.otp' ? '(login code hidden)' : r.m.body })), q);
  }

  async users(q: PageQuery & { q?: string; role?: string }) {
    const where = [];
    if (q.q) where.push(or(ilike(users.name, `%${q.q}%`), ilike(users.phone, `%${q.q}%`)));
    if (q.role) where.push(eq(users.role, q.role as typeof users.$inferSelect.role));
    const rows = await this.db
      .select({ id: users.id, name: users.name, phone: users.phone, role: users.role, language: users.language, nationality: users.nationality, isSample: users.isSample, createdAt: users.createdAt })
      .from(users)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(users.name))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(rows, q);
  }

  // ───────────── content ─────────────

  async content(kind?: string, city?: City, lang?: Language, includeInactive = false) {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          kind ? eq(contentItems.kind, kind) : undefined,
          city ? or(eq(contentItems.city, city), isNull(contentItems.city)) : undefined,
          includeInactive ? undefined : eq(contentItems.active, true),
        ),
      )
      .orderBy(asc(contentItems.sortOrder));
    if (!lang) return rows;
    return rows.map((c) => ({ id: c.id, kind: c.kind, title: pick(c.title, lang), body: pick(c.body, lang), link: c.link, city: c.city }));
  }

  async createContent(admin: AuthUser, input: typeof contentItems.$inferInsert) {
    const [row] = await this.db.insert(contentItems).values(input).returning();
    await audit(this.db, admin.id, 'content.create', { type: 'content', id: row.id });
    return row;
  }

  async updateContent(admin: AuthUser, id: string, patch: Partial<typeof contentItems.$inferInsert>) {
    const [row] = await this.db.update(contentItems).set(patch).where(eq(contentItems.id, id)).returning();
    if (!row) throw notFound('content');
    await audit(this.db, admin.id, 'content.update', { type: 'content', id }, { fields: Object.keys(patch) });
    return row;
  }
}

class OverviewQuery {
  @ApiPropertyOptional({ default: 1, description: 'Days back, Saudi time' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) days?: number;
}
class AuditQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
}
class OutboxQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['sms', 'push', 'email'] }) @IsOptional() @IsIn(['sms', 'push', 'email']) channel?: string;
}
class UsersQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
}
class ContentQuery {
  @ApiPropertyOptional({ enum: ['banner', 'help'] }) @IsOptional() @IsIn(['banner', 'help']) kind?: string;
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class ContentDto {
  @ApiProperty({ enum: ['banner', 'help'] }) @IsIn(['banner', 'help']) kind: string;
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) title: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) body?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) link?: string;
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
class ContentPatchDto {
  @ApiPropertyOptional({ type: TranslatedDto }) @IsOptional() @ValidateNested() @Type(() => TranslatedDto) title?: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) body?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) link?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('admin/overview')
  @Roles(...ADMIN)
  overview(@Query() q: OverviewQuery) {
    return this.admin.overview(q.days ?? 1);
  }

  @Get('admin/audit-log')
  @Roles('admin_ops', 'admin_finance')
  auditLog(@Query() q: AuditQuery) {
    return this.admin.auditLog(q);
  }

  @Get('admin/outbox')
  @Roles(...ADMIN)
  outbox(@Query() q: OutboxQuery) {
    return this.admin.outbox(q);
  }

  @Get('admin/users')
  @Roles(...ADMIN)
  users(@Query() q: UsersQuery) {
    return this.admin.users(q);
  }

  /** Home banners and help articles, in the reader's language. */
  @Public()
  @Get('content')
  content(@Query() q: ContentQuery, @CurrentUser() user?: AuthUser) {
    return this.admin.content(q.kind, q.city, q.lang ?? user?.language ?? 'en');
  }

  @Get('admin/content')
  @Roles('admin_ops', 'admin_support')
  allContent() {
    return this.admin.content(undefined, undefined, undefined, true);
  }

  @Post('admin/content')
  @Roles('admin_ops')
  createContent(@CurrentUser() user: AuthUser, @Body() dto: ContentDto) {
    return this.admin.createContent(user, dto);
  }

  @Patch('admin/content/:id')
  @Roles('admin_ops')
  updateContent(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContentPatchDto) {
    return this.admin.updateContent(user, id, dto);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
