import { Injectable } from '@nestjs/common';
import { and, asc, avg, count, desc, eq, gt, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { City, Language, ServiceCategory, Translated } from '@rafeeq/shared';
import { SERVICE_CATEGORIES } from '@rafeeq/shared';
import type { AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { availabilitySlots, providers, reviews, services, users, type ServiceOption } from '../db/schema.js';
import { assertProviderManager } from '../common/access.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { toPage, type PageQuery } from '../common/pagination.js';
import { pick } from '../common/translate.js';

export type SearchQuery = PageQuery & {
  category?: ServiceCategory;
  city?: City;
  language?: Language;
  q?: string;
  maxPriceHalalas?: number;
  sort?: 'rating' | 'price_asc' | 'price_desc';
  lang?: Language;
};

export type ServiceInput = {
  providerId: string;
  category: ServiceCategory;
  title: Translated;
  description?: Translated;
  priceHalalas: number;
  priceModel: 'per_trip' | 'per_hour' | 'per_person' | 'per_bag' | 'per_tag' | 'fixed';
  durationMinutes?: number;
  options?: ServiceOption[];
  languagesSpoken: Language[];
  serviceArea: City;
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  active?: boolean;
};

const SAUDI_OFFSET_MS = 3 * 3600_000;

@Injectable()
export class CatalogueService {
  constructor(@InjectDb() private readonly db: Database) {}

  private ratingSubquery() {
    return this.db
      .select({ serviceId: reviews.serviceId, average: avg(reviews.rating).as('average'), total: count().as('total') })
      .from(reviews)
      .groupBy(reviews.serviceId)
      .as('ratings');
  }

  async categories(city?: City) {
    const rows = await this.db
      .select({ category: services.category, total: count() })
      .from(services)
      .innerJoin(providers, eq(providers.id, services.providerId))
      .where(and(eq(services.active, true), eq(providers.status, 'approved'), city ? eq(services.serviceArea, city) : undefined))
      .groupBy(services.category);
    const counts = new Map(rows.map((r) => [r.category, r.total]));
    // Heritage tours link to the Zuyarah app for full trips (guide: What is not in Rafeeq).
    return SERVICE_CATEGORIES.map((c) => ({ category: c, services: counts.get(c) ?? 0, ...(c === 'heritage_tours' ? { zuyarahLink: true } : {}) }));
  }

  async search(query: SearchQuery, user?: AuthUser) {
    const lang = query.lang ?? user?.language ?? 'en';
    const r = this.ratingSubquery();
    const where: (SQL | undefined)[] = [eq(services.active, true), eq(providers.status, 'approved')];
    if (query.category) where.push(eq(services.category, query.category));
    if (query.city) where.push(eq(services.serviceArea, query.city));
    if (query.language) where.push(sql`${query.language} = ANY(${services.languagesSpoken})`);
    if (query.maxPriceHalalas !== undefined) where.push(sql`${services.priceHalalas} <= ${query.maxPriceHalalas}`);
    if (query.q) {
      const like = `%${query.q.replace(/[%_]/g, '')}%`;
      where.push(
        or(
          ilike(sql`${services.title}->>'en'`, like),
          ilike(sql`${services.title}->>${lang}`, like),
          ilike(sql`${providers.name}->>'en'`, like),
          ilike(sql`${providers.name}->>${lang}`, like),
        ),
      );
    }
    const order =
      query.sort === 'price_asc'
        ? [asc(services.priceHalalas)]
        : query.sort === 'price_desc'
          ? [desc(services.priceHalalas)]
          : [desc(sql`coalesce(${r.average}, 0)`), desc(sql`coalesce(${r.total}, 0)`), asc(services.priceHalalas)];

    const rows = await this.db
      .select({
        service: services,
        providerName: providers.name,
        ratingAverage: r.average,
        ratingCount: r.total,
      })
      .from(services)
      .innerJoin(providers, eq(providers.id, services.providerId))
      .leftJoin(r, eq(r.serviceId, services.id))
      .where(and(...where))
      .orderBy(...order)
      .limit(query.limit + 1)
      .offset(query.offset);

    const ids = rows.map((x) => x.service.id);
    const next = ids.length
      ? await this.db
          .select({ serviceId: availabilitySlots.serviceId, startsAt: sql<Date>`min(${availabilitySlots.startsAt})` })
          .from(availabilitySlots)
          .where(
            and(
              inArray(availabilitySlots.serviceId, ids),
              gt(availabilitySlots.startsAt, new Date()),
              eq(availabilitySlots.blocked, false),
              sql`${availabilitySlots.booked} + ${availabilitySlots.held} < ${availabilitySlots.capacity}`,
            ),
          )
          .groupBy(availabilitySlots.serviceId)
      : [];
    const nextBy = new Map(next.map((n) => [n.serviceId, n.startsAt]));

    return toPage(
      rows.map(({ service: s, providerName, ratingAverage, ratingCount }) => ({
        id: s.id,
        category: s.category,
        title: pick(s.title, lang),
        priceHalalas: s.priceHalalas,
        priceModel: s.priceModel,
        durationMinutes: s.durationMinutes,
        languagesSpoken: s.languagesSpoken,
        serviceArea: s.serviceArea,
        provider: { id: s.providerId, name: pick(providerName, lang), verified: true },
        rating: { average: ratingAverage ? Number(Number(ratingAverage).toFixed(1)) : null, count: Number(ratingCount ?? 0) },
        nextAvailable: nextBy.get(s.id) ? new Date(nextBy.get(s.id)!).toISOString() : null,
      })),
      query,
    );
  }

  async detail(id: string, lang: Language) {
    const [row] = await this.db
      .select({ service: services, provider: providers })
      .from(services)
      .innerJoin(providers, eq(providers.id, services.providerId))
      .where(eq(services.id, id))
      .limit(1);
    if (!row || !row.service.active || row.provider.status !== 'approved') throw notFound('service');
    const { service: s, provider: p } = row;

    const [rating] = await this.db
      .select({ average: avg(reviews.rating), total: count() })
      .from(reviews)
      .where(eq(reviews.serviceId, id));
    const latest = await this.db
      .select({ id: reviews.id, rating: reviews.rating, text: reviews.text, language: reviews.language, reply: reviews.reply, createdAt: reviews.createdAt, author: users.name })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(eq(reviews.serviceId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    return {
      id: s.id,
      category: s.category,
      title: pick(s.title, lang),
      description: pick(s.description, lang),
      titles: s.title,
      priceHalalas: s.priceHalalas,
      priceModel: s.priceModel,
      durationMinutes: s.durationMinutes,
      options: (s.options ?? []).map((o) => ({ key: o.key, title: pick(o.title, lang), priceHalalas: o.priceHalalas })),
      languagesSpoken: s.languagesSpoken,
      serviceArea: s.serviceArea,
      cancellationPolicy: s.cancellationPolicy,
      provider: { id: p.id, name: pick(p.name, lang), verified: true, city: p.city },
      rating: { average: rating.average ? Number(Number(rating.average).toFixed(1)) : null, count: rating.total },
      // Reviews are shown in the language they were written in; the app marks machine translation if it adds one.
      reviews: latest.map((r) => ({ ...r, author: r.author.split(' ')[0] })),
      slots: await this.availableSlots(id, new Date(), new Date(Date.now() + 7 * 24 * 3600_000)),
    };
  }

  async availableSlots(serviceId: string, from: Date, to: Date) {
    const rows = await this.db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.serviceId, serviceId),
          gte(availabilitySlots.startsAt, from),
          lt(availabilitySlots.startsAt, to),
          eq(availabilitySlots.blocked, false),
        ),
      )
      .orderBy(asc(availabilitySlots.startsAt));
    return rows.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      remaining: Math.max(0, s.capacity - s.booked - s.held),
    }));
  }

  // ───────────── provider side ─────────────

  private async assertServicesProvider(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    const [p] = await this.db.select().from(providers).where(eq(providers.id, providerId));
    if (!p) throw notFound('provider');
    if (p.kind !== 'services') throw badRequest('service.shop_cannot_list', 'Shops list products, not services');
    if (p.status === 'suspended' || p.status === 'rejected') throw conflict('provider.not_active', 'Provider is not active');
    return p;
  }

  private validateOptions(options?: ServiceOption[]) {
    const keys = new Set<string>();
    for (const o of options ?? []) {
      if (keys.has(o.key)) throw badRequest('service.duplicate_option', `Duplicate option key ${o.key}`);
      keys.add(o.key);
    }
  }

  async listForProvider(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    return this.db.select().from(services).where(eq(services.providerId, providerId)).orderBy(asc(services.category));
  }

  async create(user: AuthUser, input: ServiceInput) {
    await this.assertServicesProvider(user, input.providerId);
    this.validateOptions(input.options);
    const [row] = await this.db.insert(services).values(input).returning();
    return row;
  }

  async update(user: AuthUser, id: string, patch: Partial<Omit<ServiceInput, 'providerId'>>) {
    const [s] = await this.db.select().from(services).where(eq(services.id, id));
    if (!s) throw notFound('service');
    await this.assertServicesProvider(user, s.providerId);
    this.validateOptions(patch.options);
    const [row] = await this.db.update(services).set(patch).where(eq(services.id, id)).returning();
    return row;
  }

  async providerSlots(user: AuthUser, serviceId: string, from: Date, to: Date) {
    const [s] = await this.db.select().from(services).where(eq(services.id, serviceId));
    if (!s) throw notFound('service');
    assertProviderManager(user, s.providerId);
    return this.db
      .select()
      .from(availabilitySlots)
      .where(and(eq(availabilitySlots.serviceId, serviceId), gte(availabilitySlots.startsAt, from), lt(availabilitySlots.startsAt, to)))
      .orderBy(asc(availabilitySlots.startsAt));
  }

  /**
   * Create slots for several days at the given Saudi-time hours. Existing slots at the
   * same start time are left alone. Returns how many were created.
   */
  async generateSlots(
    user: AuthUser,
    serviceId: string,
    input: { fromDate: string; days: number; hours: number[]; capacity: number; durationMinutes?: number },
  ) {
    const [s] = await this.db.select().from(services).where(eq(services.id, serviceId));
    if (!s) throw notFound('service');
    await this.assertServicesProvider(user, s.providerId);
    const [y, m, d] = input.fromDate.split('-').map(Number);
    const minutes = input.durationMinutes ?? Math.min(s.durationMinutes ?? 60, 240);
    const wanted: { startsAt: Date; endsAt: Date }[] = [];
    for (let day = 0; day < input.days; day++) {
      for (const hour of input.hours) {
        const startsAt = new Date(Date.UTC(y, m - 1, d + day, hour) - SAUDI_OFFSET_MS);
        wanted.push({ startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) });
      }
    }
    const existing = await this.db
      .select({ startsAt: availabilitySlots.startsAt })
      .from(availabilitySlots)
      .where(and(eq(availabilitySlots.serviceId, serviceId), inArray(availabilitySlots.startsAt, wanted.map((w) => w.startsAt))));
    const taken = new Set(existing.map((e) => e.startsAt.getTime()));
    const fresh = wanted.filter((w) => !taken.has(w.startsAt.getTime()));
    if (fresh.length) {
      await this.db.insert(availabilitySlots).values(fresh.map((w) => ({ serviceId, ...w, capacity: input.capacity })));
    }
    return { created: fresh.length, skipped: wanted.length - fresh.length };
  }

  async updateSlot(user: AuthUser, slotId: string, patch: { capacity?: number; blocked?: boolean }) {
    return this.db.transaction(async (tx) => {
      const [slot] = await tx.select().from(availabilitySlots).where(eq(availabilitySlots.id, slotId)).for('update');
      if (!slot) throw notFound('slot');
      const [s] = await tx.select().from(services).where(eq(services.id, slot.serviceId));
      assertProviderManager(user, s.providerId);
      if (patch.capacity !== undefined && patch.capacity < slot.booked + slot.held) {
        throw conflict('slot.capacity_below_booked', 'Capacity cannot be lower than what is already booked', {
          booked: slot.booked,
          held: slot.held,
        });
      }
      const [row] = await tx.update(availabilitySlots).set(patch).where(eq(availabilitySlots.id, slotId)).returning();
      return row;
    });
  }
}
