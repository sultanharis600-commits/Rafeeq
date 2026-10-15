import { Inject, Injectable } from '@nestjs/common';
import { and, avg, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { ProviderStatus, Translated } from '@rafeeq/shared';
import type { AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { providers, reviews, services, staffMembers, users, type ProviderDocument } from '../db/schema.js';
import { assertProviderManager } from '../common/access.js';
import { audit } from '../common/audit.js';
import { ibanLast4, SAUDI_IBAN } from '../common/crypto.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { recordStatus } from '../common/status.js';
import { CryptoService } from '../core/crypto.service.js';
import type { PageQuery } from '../common/pagination.js';
import { toPage } from '../common/pagination.js';

const PROVIDER_FLOW: Record<ProviderStatus, readonly ProviderStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['suspended'],
  suspended: ['approved'],
  rejected: ['pending'],
};

export type ApplyInput = {
  type: 'company' | 'individual';
  kind: 'services' | 'shop';
  name: Translated;
  description?: Translated;
  crNumber?: string;
  city: 'makkah' | 'madinah';
  phone?: string;
  iban?: string;
  documents?: ProviderDocument[];
};

@Injectable()
export class ProvidersService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(CryptoService) private readonly crypto: CryptoService,
  ) {}

  /** What the API returns about a provider: never the IBAN itself. */
  private view(p: typeof providers.$inferSelect) {
    const { ibanEncrypted, ...rest } = p;
    return { ...rest, ibanLast4: ibanEncrypted ? ibanLast4(this.crypto.decrypt(ibanEncrypted)) : null };
  }

  async get(id: string) {
    const [p] = await this.db.select().from(providers).where(eq(providers.id, id)).limit(1);
    if (!p) throw notFound('provider');
    return p;
  }

  /** A user applies to sell on Rafeeq. The account waits for Bidec to verify documents. */
  async apply(user: AuthUser, input: ApplyInput) {
    if (user.role !== 'pilgrim' && user.role !== 'provider_owner') {
      throw badRequest('provider.role_cannot_apply', 'Staff and admin accounts cannot open a provider');
    }
    if (input.type === 'company' && !input.crNumber) {
      throw badRequest('provider.cr_required', 'Companies need a Commercial Registration number');
    }
    if (input.iban && !SAUDI_IBAN.test(input.iban)) throw badRequest('provider.invalid_iban', 'IBAN must be a Saudi IBAN (SA + 22 digits)');

    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .insert(providers)
        .values({
          ownerId: user.id,
          type: input.type,
          kind: input.kind,
          name: input.name,
          description: input.description,
          crNumber: input.crNumber,
          city: input.city,
          phone: input.phone,
          ibanEncrypted: input.iban ? this.crypto.encrypt(input.iban) : null,
          documents: input.documents ?? [],
          status: 'pending',
          // Early providers: first 3 months without commission (guide: Payments).
          commissionFreeUntil: new Date(Date.now() + 90 * 24 * 3600_000),
        })
        .returning();
      if (user.role === 'pilgrim') await tx.update(users).set({ role: 'provider_owner' }).where(eq(users.id, user.id));
      await recordStatus(tx, { entityType: 'provider', entityId: p.id, from: null, to: 'pending', actorId: user.id });
      return this.view(p);
    });
  }

  async mine(user: AuthUser) {
    if (!user.providerIds.length) return [];
    const rows = await this.db.select().from(providers).where(inArray(providers.id, user.providerIds));
    return rows.map((p) => this.view(p));
  }

  async update(user: AuthUser, id: string, patch: Partial<ApplyInput>) {
    assertProviderManager(user, id);
    const current = await this.get(id);
    if (patch.iban && !SAUDI_IBAN.test(patch.iban)) throw badRequest('provider.invalid_iban', 'IBAN must be a Saudi IBAN (SA + 22 digits)');
    const { iban, type: _type, kind: _kind, city: _city, ...rest } = patch;
    // Changing documents or IBAN of an approved provider sends it back for review would be stricter;
    // for the MVP we keep the status and log the change for operations.
    const [p] = await this.db
      .update(providers)
      .set({ ...rest, ...(iban ? { ibanEncrypted: this.crypto.encrypt(iban) } : {}) })
      .where(eq(providers.id, id))
      .returning();
    if (iban || patch.documents) {
      await audit(this.db, user.id, 'provider.sensitive_update', { type: 'provider', id }, {
        iban: Boolean(iban),
        documents: Boolean(patch.documents),
        status: current.status,
      });
    }
    return this.view(p);
  }

  /** Public profile shown to pilgrims (only approved providers). */
  async publicProfile(id: string) {
    const p = await this.get(id);
    if (p.status !== 'approved') throw notFound('provider');
    const [rating] = await this.db
      .select({ average: avg(reviews.rating), count: count() })
      .from(reviews)
      .where(eq(reviews.providerId, id));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      kind: p.kind,
      type: p.type,
      city: p.city,
      verified: true,
      rating: { average: rating.average ? Number(Number(rating.average).toFixed(1)) : null, count: rating.count },
    };
  }

  // ───────────── staff ─────────────

  async listStaff(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    return this.db
      .select({
        id: staffMembers.id,
        userId: users.id,
        name: users.name,
        phone: users.phone,
        staffRole: staffMembers.staffRole,
        vehicle: staffMembers.vehicle,
        active: staffMembers.active,
      })
      .from(staffMembers)
      .innerJoin(users, eq(users.id, staffMembers.userId))
      .where(eq(staffMembers.providerId, providerId));
  }

  /** Add a driver, guide, luggage handler… by phone. They log in with OTP and see staff mode. */
  async addStaff(
    user: AuthUser,
    providerId: string,
    input: { phone: string; name: string; staffRole: 'driver' | 'guide' | 'photographer' | 'luggage' | 'assistant'; vehicle?: string },
  ) {
    assertProviderManager(user, providerId);
    return this.db.transaction(async (tx) => {
      let [u] = await tx.select().from(users).where(eq(users.phone, input.phone)).limit(1);
      if (u && u.role !== 'staff') {
        throw conflict('staff.phone_in_use', 'This phone belongs to a pilgrim or provider account; use another number');
      }
      if (!u) [u] = await tx.insert(users).values({ phone: input.phone, name: input.name, role: 'staff', language: 'ar' }).returning();
      const [existing] = await tx
        .select()
        .from(staffMembers)
        .where(and(eq(staffMembers.userId, u.id), eq(staffMembers.providerId, providerId)));
      if (existing) {
        const [row] = await tx
          .update(staffMembers)
          .set({ active: true, staffRole: input.staffRole, vehicle: input.vehicle })
          .where(eq(staffMembers.id, existing.id))
          .returning();
        return row;
      }
      const [row] = await tx
        .insert(staffMembers)
        .values({ userId: u.id, providerId, staffRole: input.staffRole, vehicle: input.vehicle })
        .returning();
      return row;
    });
  }

  async deactivateStaff(user: AuthUser, providerId: string, staffId: string) {
    assertProviderManager(user, providerId);
    const res = await this.db
      .update(staffMembers)
      .set({ active: false })
      .where(and(eq(staffMembers.id, staffId), eq(staffMembers.providerId, providerId)))
      .returning();
    if (!res.length) throw notFound('staff');
  }

  // ───────────── admin ─────────────

  async adminList(q: PageQuery & { status?: ProviderStatus; kind?: 'services' | 'shop' }) {
    const where: SQL[] = [];
    if (q.status) where.push(eq(providers.status, q.status));
    if (q.kind) where.push(eq(providers.kind, q.kind));
    const rows = await this.db
      .select({
        provider: providers,
        ownerName: users.name,
        ownerPhone: users.phone,
        serviceCount: count(services.id),
      })
      .from(providers)
      .innerJoin(users, eq(users.id, providers.ownerId))
      .leftJoin(services, eq(services.providerId, providers.id))
      .where(where.length ? and(...where) : undefined)
      .groupBy(providers.id, users.id)
      .orderBy(desc(providers.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({ ...this.view(r.provider), ownerName: r.ownerName, ownerPhone: r.ownerPhone, serviceCount: r.serviceCount })),
      q,
    );
  }

  async setStatus(admin: AuthUser, id: string, to: ProviderStatus, reason?: string) {
    return this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(providers).where(eq(providers.id, id)).for('update');
      if (!p) throw notFound('provider');
      if (!PROVIDER_FLOW[p.status].includes(to)) {
        throw conflict('provider.invalid_transition', `Cannot move provider from ${p.status} to ${to}`, { from: p.status, to });
      }
      const docs = (p.documents ?? []).map((d) => (to === 'approved' ? { ...d, verified: true } : d));
      const [row] = await tx.update(providers).set({ status: to, documents: docs }).where(eq(providers.id, id)).returning();
      await recordStatus(tx, { entityType: 'provider', entityId: id, from: p.status, to, actorId: admin.id, reason });
      await audit(tx, admin.id, `provider.${to}`, { type: 'provider', id }, { reason });
      // Suspending a provider hides all its listings immediately.
      return this.view(row);
    });
  }

  async setCommission(admin: AuthUser, id: string, input: { commissionRateBps: number; commissionFreeUntil?: Date | null }) {
    const before = await this.get(id);
    const [row] = await this.db
      .update(providers)
      .set({ commissionRateBps: input.commissionRateBps, commissionFreeUntil: input.commissionFreeUntil ?? null })
      .where(eq(providers.id, id))
      .returning();
    await audit(this.db, admin.id, 'provider.commission', { type: 'provider', id }, {
      from: before.commissionRateBps,
      to: input.commissionRateBps,
      freeUntil: input.commissionFreeUntil ?? null,
    });
    return this.view(row);
  }
}
