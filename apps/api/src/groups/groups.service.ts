import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { emergencyContacts, groupMembers, locationPoints, lostAlerts, travelGroups, users } from '../db/schema.js';
import { audit } from '../common/audit.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { recordStatus } from '../common/status.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DAY = 24 * 3600_000;

export type PointInput = { lat: number; lng: number; accuracyM?: number; recordedAt: Date; source?: 'gps' | 'sms' | 'tag' };

/** Saudi calendar date (YYYY-MM-DD) for a moment. */
const saudiDate = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/**
 * Lost Companion (guide: Accessibility help and Lost Companion): travel groups, last
 * known location, "I'm lost" alerts by app or SMS, and Bluetooth finder IDs.
 * Locations are shared only inside the user's travel groups, with consent.
 */
@Injectable()
export class GroupsService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Rotating Bluetooth ID: changes every day so strangers can't track a phone over time.
   * Group members get each other's IDs for today and the next two days, so the finder
   * works without any network.
   */
  bleId(userId: string, day: string): string {
    return createHmac('sha256', this.config.get('JWT_SECRET', { infer: true })).update(`ble:${userId}:${day}`).digest('hex').slice(0, 16);
  }

  bleIds(userId: string, from = new Date()) {
    return [0, 1, 2].map((i) => {
      const day = saudiDate(new Date(from.getTime() + i * DAY));
      return { day, id: this.bleId(userId, day) };
    });
  }

  private async memberships(userId: string) {
    return this.db.select().from(groupMembers).where(eq(groupMembers.userId, userId));
  }

  private async assertMember(userId: string, groupId: string) {
    const [m] = await this.db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    if (!m) throw notFound('group');
    return m;
  }

  private newCode() {
    let a = '';
    for (let i = 0; i < 3; i++) a += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return `${a}-${String(randomInt(1000, 10000))}`;
  }

  async create(user: AuthUser, name: string) {
    if (user.role !== 'pilgrim') throw forbidden('group.pilgrims_only', 'Travel groups are for pilgrims');
    return this.db.transaction(async (tx) => {
      let code = this.newCode();
      for (let i = 0; i < 5; i++) {
        const [taken] = await tx.select({ id: travelGroups.id }).from(travelGroups).where(eq(travelGroups.joinCode, code));
        if (!taken) break;
        code = this.newCode();
      }
      const [g] = await tx.insert(travelGroups).values({ name, joinCode: code, leaderId: user.id }).returning();
      await tx.insert(groupMembers).values({ groupId: g.id, userId: user.id, role: 'leader' });
      return g;
    });
  }

  /** Join with the code shown as a QR on the leader's phone. */
  async join(user: AuthUser, joinCode: string, relation?: string) {
    if (user.role !== 'pilgrim') throw forbidden('group.pilgrims_only', 'Travel groups are for pilgrims');
    const [g] = await this.db.select().from(travelGroups).where(eq(travelGroups.joinCode, joinCode.trim().toUpperCase()));
    if (!g) throw notFound('group');
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(groupMembers).where(eq(groupMembers.groupId, g.id));
    if (n >= 50) throw conflict('group.full', 'Groups have up to 50 members');
    await this.db.insert(groupMembers).values({ groupId: g.id, userId: user.id, relation }).onConflictDoNothing();
    await this.realtime.joinGroups(user.id, [g.id]);
    return this.get(user, g.id);
  }

  async leave(user: AuthUser, groupId: string, memberUserId?: string) {
    const me = await this.assertMember(user.id, groupId);
    const target = memberUserId ?? user.id;
    if (target !== user.id && me.role !== 'leader') throw forbidden('group.leader_only', 'Only the leader can remove members');
    const [g] = await this.db.select().from(travelGroups).where(eq(travelGroups.id, groupId));
    if (target === g.leaderId) throw conflict('group.leader_cannot_leave', 'Hand over leadership before leaving');
    await this.db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, target)));
  }

  async updateMe(user: AuthUser, groupId: string, patch: { relation?: string; trackerTag?: string | null }) {
    await this.assertMember(user.id, groupId);
    await this.db.update(groupMembers).set(patch).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
    return this.get(user, groupId);
  }

  async setLeader(user: AuthUser, groupId: string, newLeaderId: string) {
    const me = await this.assertMember(user.id, groupId);
    if (me.role !== 'leader') throw forbidden('group.leader_only', 'Only the leader can do this');
    await this.assertMember(newLeaderId, groupId);
    await this.db.transaction(async (tx) => {
      await tx.update(groupMembers).set({ role: 'member' }).where(eq(groupMembers.groupId, groupId));
      await tx.update(groupMembers).set({ role: 'leader' }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newLeaderId)));
      await tx.update(travelGroups).set({ leaderId: newLeaderId }).where(eq(travelGroups.id, groupId));
    });
    return this.get(user, groupId);
  }

  async mine(user: AuthUser) {
    const ms = await this.memberships(user.id);
    await this.realtime.joinGroups(user.id, ms.map((m) => m.groupId));
    return Promise.all(ms.map((m) => this.get(user, m.groupId)));
  }

  /** Group with members, their last known location (if they share it) and open alerts. */
  async get(user: AuthUser, groupId: string) {
    await this.assertMember(user.id, groupId);
    const [g] = await this.db.select().from(travelGroups).where(eq(travelGroups.id, groupId));
    const members = await this.db
      .select({ userId: users.id, name: users.name, phone: users.phone, language: users.language, sharing: users.locationSharingAt, accessibilityMode: users.accessibilityMode, needs: users.accessibilityNeeds, role: groupMembers.role, relation: groupMembers.relation, trackerTag: groupMembers.trackerTag })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId));
    const ids = members.map((m) => m.userId);
    const lastPoints = ids.length
      ? await this.db
          .selectDistinctOn([locationPoints.userId])
          .from(locationPoints)
          .where(inArray(locationPoints.userId, ids))
          .orderBy(locationPoints.userId, desc(locationPoints.recordedAt))
      : [];
    const alerts = await this.db
      .select()
      .from(lostAlerts)
      .where(and(eq(lostAlerts.groupId, groupId), inArray(lostAlerts.status, ['open', 'acknowledged'])))
      .orderBy(desc(lostAlerts.createdAt));
    const alertUsers = new Set(alerts.map((a) => a.userId));
    return {
      id: g.id,
      name: g.name,
      joinCode: g.joinCode,
      leaderId: g.leaderId,
      members: members.map((m) => {
        const p = lastPoints.find((x) => x.userId === m.userId);
        // Location is shown only with consent, or while that member has an open alert.
        const show = Boolean(m.sharing) || alertUsers.has(m.userId);
        return {
          userId: m.userId,
          name: m.name,
          phone: m.phone,
          language: m.language,
          role: m.role,
          relation: m.relation,
          trackerTag: m.trackerTag,
          accessibilityMode: m.accessibilityMode,
          needs: m.needs,
          sharesLocation: Boolean(m.sharing),
          lastLocation: show && p ? { lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, source: p.source, recordedAt: p.recordedAt.toISOString() } : null,
          bleIds: this.bleIds(m.userId),
        };
      }),
      alerts: alerts.map((a) => ({ id: a.id, userId: a.userId, status: a.status, channel: a.channel, lat: a.lat, lng: a.lng, createdAt: a.createdAt.toISOString() })),
    };
  }

  // ───────────── locations ─────────────

  /** Upload location points recorded in the background (batched when data returns). */
  async addPoints(user: AuthUser, points: PointInput[]) {
    const [u] = await this.db.select({ sharing: users.locationSharingAt }).from(users).where(eq(users.id, user.id));
    if (!u?.sharing) throw conflict('location.no_consent', 'Turn on location sharing with your group first');
    const ms = await this.memberships(user.id);
    if (!ms.length) throw conflict('location.no_group', 'Join a travel group to share your location');
    const now = Date.now();
    const valid = points.filter((p) => p.recordedAt.getTime() <= now + 60_000 && p.recordedAt.getTime() > now - 2 * DAY);
    if (valid.length) {
      await this.db.insert(locationPoints).values(valid.map((p) => ({ userId: user.id, lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, source: p.source ?? 'gps', recordedAt: p.recordedAt })));
      const last = valid.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b));
      for (const m of ms) this.realtime.emit(`group:${m.groupId}`, 'member.location', { userId: user.id, lat: last.lat, lng: last.lng, recordedAt: last.recordedAt.toISOString() });
    }
    return { stored: valid.length, ignored: points.length - valid.length };
  }

  // ───────────── lost alerts ─────────────

  /**
   * "I'm lost": tells every group the user belongs to (push), the group leaders and the
   * user's emergency contacts (SMS with a map link). The app also sends its own SMS to the
   * leader directly when there is no data connection; that one doesn't reach this server.
   */
  async raiseAlert(userId: string, input: { lat?: number; lng?: number; accuracyM?: number; message?: string; channel: 'app' | 'sms' }) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw notFound('user');
    const ms = await this.memberships(userId);
    // One open alert per user at a time: repeated presses update the location.
    const [open] = await this.db.select().from(lostAlerts).where(and(eq(lostAlerts.userId, userId), inArray(lostAlerts.status, ['open', 'acknowledged'])));
    let lat = input.lat;
    let lng = input.lng;
    if (lat === undefined || lng === undefined) {
      const [p] = await this.db.select().from(locationPoints).where(eq(locationPoints.userId, userId)).orderBy(desc(locationPoints.recordedAt)).limit(1);
      lat = p?.lat;
      lng = p?.lng;
    }
    if (lat !== undefined && lng !== undefined) {
      await this.db.insert(locationPoints).values({ userId, lat, lng, accuracyM: input.accuracyM, source: input.channel === 'sms' ? 'sms' : 'gps', recordedAt: new Date() });
    }
    if (open) {
      await this.db.update(lostAlerts).set({ lat, lng }).where(eq(lostAlerts.id, open.id));
      for (const m of ms) this.realtime.emit(`group:${m.groupId}`, 'lost.updated', { alertId: open.id, userId, lat, lng });
      return { ...open, lat, lng, repeated: true };
    }

    const alerts = [];
    const groupIds = ms.map((m) => m.groupId);
    for (const gid of groupIds.length ? groupIds : [null]) {
      const [a] = await this.db.insert(lostAlerts).values({ userId, groupId: gid, channel: input.channel, lat, lng, message: input.message }).returning();
      await recordStatus(this.db, { entityType: 'lost_alert', entityId: a.id, from: null, to: 'open', actorId: userId, reason: input.channel });
      alerts.push(a);
    }

    const map = lat !== undefined && lng !== undefined ? mapLink(lat, lng) : '—';
    const params = { name: u.name, map };
    const others = groupIds.length
      ? await this.db
          .select({ userId: groupMembers.userId, role: groupMembers.role, groupId: groupMembers.groupId })
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, groupIds))
      : [];
    const recipients = others.filter((o) => o.userId !== userId);
    await this.notifications.toUsers(recipients.map((r) => r.userId), 'lost.alert', params, { data: { alertId: alerts[0].id, userId } });
    const leaders = [...new Set(recipients.filter((r) => r.role === 'leader').map((r) => r.userId))];
    await this.notifications.toUsers(leaders, 'lost.alert', params, { channel: 'sms', data: { alertId: alerts[0].id } });
    const contacts = await this.db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
    const leaderPhones = new Set((leaders.length ? await this.db.select({ phone: users.phone }).from(users).where(inArray(users.id, leaders)) : []).map((l) => l.phone));
    for (const c of contacts) {
      if (!leaderPhones.has(c.phone)) await this.notifications.smsToPhone(c.phone, 'lost.alert', u.language, params);
    }
    for (const a of alerts) {
      if (a.groupId) this.realtime.emit(`group:${a.groupId}`, 'lost.alert', { alertId: a.id, userId, name: u.name, lat, lng });
    }
    this.realtime.emit('admin', 'lost.alert', { count: alerts.length });
    return { ...alerts[0], repeated: false };
  }

  /**
   * Inbound SMS from the SMS provider's webhook. The app sends "RFQ LOST <lat>,<lng> <accuracy>"
   * to the Rafeeq number when there is signal but no data. Any text containing coordinates
   * from a known phone raises an alert.
   */
  async inboundSms(from: string, body: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.phone, from));
    if (!u) return { handled: false, reason: 'unknown sender' };
    if (!/\b(LOST|RFQ)\b/i.test(body)) return { handled: false, reason: 'not a lost alert' };
    const m = /(-?\d{1,2}\.\d{3,7})\s*,\s*(-?\d{1,3}\.\d{3,7})(?:\s+(\d{1,5}))?/.exec(body);
    const alert = await this.raiseAlert(u.id, {
      channel: 'sms',
      lat: m ? Number(m[1]) : undefined,
      lng: m ? Number(m[2]) : undefined,
      accuracyM: m?.[3] ? Number(m[3]) : undefined,
      message: 'Sent by SMS',
    });
    return { handled: true, alertId: alert.id };
  }

  async setAlertStatus(user: AuthUser, alertId: string, to: 'acknowledged' | 'resolved') {
    const [a] = await this.db.select().from(lostAlerts).where(eq(lostAlerts.id, alertId));
    if (!a) throw notFound('lost_alert');
    const isSelf = a.userId === user.id;
    if (!isSelf && !(a.groupId && (await this.isMember(user.id, a.groupId))) && !isAdmin(user)) throw notFound('lost_alert');
    if (a.status === 'resolved') throw conflict('lost_alert.closed', 'This alert is already closed');
    if (to === 'acknowledged' && a.status !== 'open') throw conflict('lost_alert.invalid_transition', 'Already acknowledged');

    // Resolving closes the user's alerts in every group at once.
    const targets = to === 'resolved'
      ? await this.db.select().from(lostAlerts).where(and(eq(lostAlerts.userId, a.userId), inArray(lostAlerts.status, ['open', 'acknowledged'])))
      : [a];
    for (const t of targets) {
      await this.db.update(lostAlerts).set({ status: to, resolvedAt: to === 'resolved' ? new Date() : null }).where(eq(lostAlerts.id, t.id));
      await recordStatus(this.db, { entityType: 'lost_alert', entityId: t.id, from: t.status, to, actorId: user.id });
      if (t.groupId) this.realtime.emit(`group:${t.groupId}`, 'lost.updated', { alertId: t.id, userId: a.userId, status: to });
    }
    if (to === 'resolved') {
      const [u] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, a.userId));
      const groupIds = targets.map((t) => t.groupId).filter(Boolean) as string[];
      const members = groupIds.length ? await this.db.select({ userId: groupMembers.userId }).from(groupMembers).where(inArray(groupMembers.groupId, groupIds)) : [];
      await this.notifications.toUsers(members.map((m) => m.userId).filter((id) => id !== user.id), 'lost.resolved', { name: u.name });
    }
    if (isAdmin(user)) await audit(this.db, user.id, `lost_alert.${to}`, { type: 'lost_alert', id: alertId });
    return { id: alertId, status: to };
  }

  private async isMember(userId: string, groupId: string) {
    const [m] = await this.db.select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return Boolean(m);
  }

  async alertsForMe(user: AuthUser) {
    const ms = await this.memberships(user.id);
    const groupIds = ms.map((m) => m.groupId);
    return this.db
      .select({ alert: lostAlerts, name: users.name })
      .from(lostAlerts)
      .innerJoin(users, eq(users.id, lostAlerts.userId))
      .where(
        and(
          inArray(lostAlerts.status, ['open', 'acknowledged']),
          groupIds.length ? or(inArray(lostAlerts.groupId, groupIds), eq(lostAlerts.userId, user.id)) : eq(lostAlerts.userId, user.id),
        ),
      )
      .orderBy(desc(lostAlerts.createdAt));
  }

  // ───────────── admin ─────────────

  /** Counts and age only. Locations need a logged reason (guide: Admin panel). */
  async adminAlerts() {
    const rows = await this.db
      .select({ id: lostAlerts.id, status: lostAlerts.status, channel: lostAlerts.channel, createdAt: lostAlerts.createdAt, resolvedAt: lostAlerts.resolvedAt, groupId: lostAlerts.groupId })
      .from(lostAlerts)
      .where(gte(lostAlerts.createdAt, new Date(Date.now() - 7 * DAY)))
      .orderBy(desc(lostAlerts.createdAt));
    return {
      open: rows.filter((r) => r.status !== 'resolved').length,
      last7Days: rows.length,
      alerts: rows.map((r) => ({ ...r, ageMinutes: Math.round(((r.resolvedAt ?? new Date()).getTime() - r.createdAt.getTime()) / 60_000) })),
    };
  }

  async adminRevealLocation(admin: AuthUser, alertId: string, reason: string) {
    if (reason.trim().length < 10) throw badRequest('lost_alert.reason_required', 'Say why you need the location (e.g. which family asked)');
    const [a] = await this.db.select().from(lostAlerts).where(eq(lostAlerts.id, alertId));
    if (!a) throw notFound('lost_alert');
    await audit(this.db, admin.id, 'lost_alert.view_location', { type: 'lost_alert', id: alertId }, { reason });
    const [u] = await this.db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, a.userId));
    const [p] = await this.db.select().from(locationPoints).where(eq(locationPoints.userId, a.userId)).orderBy(desc(locationPoints.recordedAt)).limit(1);
    return { alertId, person: u, alertLocation: a.lat !== null ? { lat: a.lat, lng: a.lng } : null, lastKnown: p ? { lat: p.lat, lng: p.lng, recordedAt: p.recordedAt.toISOString(), source: p.source } : null };
  }

  // ───────────── retention ─────────────

  /** Delete locations 7 days after the trip ends (or after 30 days without trip dates). */
  async purgeOldLocations(now = new Date()): Promise<number> {
    const res = await this.db
      .delete(locationPoints)
      .where(
        or(
          lt(locationPoints.recordedAt, new Date(now.getTime() - 30 * DAY)),
          inArray(
            locationPoints.userId,
            this.db.select({ id: users.id }).from(users).where(and(isNotNull(users.travelTo), lt(users.travelTo, new Date(now.getTime() - 7 * DAY)))),
          ),
        ),
      )
      .returning({ id: locationPoints.id });
    return res.length;
  }

  /** Shared-secret check for the SMS provider's webhook. */
  assertSmsSecret(header: string | undefined) {
    const secret = this.config.get('SMS_WEBHOOK_SECRET', { infer: true });
    if (!secret || header !== secret) throw new AppError(HttpStatus.UNAUTHORIZED, 'sms.bad_signature', 'Invalid webhook secret');
  }
}
