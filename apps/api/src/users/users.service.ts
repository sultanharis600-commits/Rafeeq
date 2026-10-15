import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import {
  bookings,
  emergencyContacts,
  groupMembers,
  locationPoints,
  lostAlerts,
  orders,
  places,
  reviews,
  users,
} from '../db/schema.js';
import { badRequest, notFound } from '../common/errors.js';

@Injectable()
export class UsersService {
  constructor(@InjectDb() private readonly db: Database) {}

  async profile(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw notFound('user');
    let hotel = null;
    if (u.hotelPlaceId) {
      [hotel] = await this.db
        .select({ id: places.id, name: places.name, lat: places.lat, lng: places.lng })
        .from(places)
        .where(eq(places.id, u.hotelPlaceId));
    }
    return { ...u, hotel };
  }

  async update(id: string, input: Partial<typeof users.$inferInsert> & { locationSharing?: boolean }) {
    const { locationSharing, ...patch } = input;
    if (locationSharing !== undefined) patch.locationSharingAt = locationSharing ? new Date() : null;
    if (locationSharing === false) {
      // Turning sharing off deletes what was already stored (PDPL: consent withdrawn).
      await this.db.delete(locationPoints).where(eq(locationPoints.userId, id));
    }
    if (patch.hotelPlaceId) {
      const [p] = await this.db.select({ type: places.type }).from(places).where(eq(places.id, patch.hotelPlaceId));
      if (!p || p.type !== 'hotel') throw badRequest('user.invalid_hotel', 'hotelPlaceId must be a hotel');
    }
    if (patch.travelFrom && patch.travelTo && patch.travelFrom > patch.travelTo) {
      throw badRequest('user.invalid_dates', 'travelFrom must be before travelTo');
    }
    await this.db.update(users).set(patch).where(eq(users.id, id));
    return this.profile(id);
  }

  contacts(userId: string) {
    return this.db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
  }

  async addContact(userId: string, c: { name: string; phone: string; relation?: string }) {
    const existing = await this.contacts(userId);
    if (existing.length >= 5) throw badRequest('user.too_many_contacts', 'Up to 5 emergency contacts');
    const [row] = await this.db.insert(emergencyContacts).values({ userId, ...c }).returning();
    return row;
  }

  async removeContact(userId: string, id: string) {
    const res = await this.db
      .delete(emergencyContacts)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)))
      .returning({ id: emergencyContacts.id });
    if (!res.length) throw notFound('emergency_contact');
  }

  async exportData(userId: string) {
    const [profile, contacts, myBookings, myOrders, myReviews, memberships, myLocations, myAlerts] = await Promise.all([
      this.profile(userId),
      this.contacts(userId),
      this.db.select().from(bookings).where(eq(bookings.pilgrimId, userId)),
      this.db.select().from(orders).where(eq(orders.pilgrimId, userId)),
      this.db.select().from(reviews).where(eq(reviews.authorId, userId)),
      this.db.select().from(groupMembers).where(eq(groupMembers.userId, userId)),
      this.db.select().from(locationPoints).where(eq(locationPoints.userId, userId)),
      this.db.select().from(lostAlerts).where(eq(lostAlerts.userId, userId)),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      emergencyContacts: contacts,
      bookings: myBookings,
      orders: myOrders,
      reviews: myReviews,
      groupMemberships: memberships,
      locationPoints: myLocations,
      lostAlerts: myAlerts,
    };
  }

  async deleteAccount(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(locationPoints).where(eq(locationPoints.userId, userId));
      await tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
      await tx.delete(groupMembers).where(eq(groupMembers.userId, userId));
      await tx
        .update(users)
        .set({
          phone: `deleted:${userId}`,
          name: 'Deleted user',
          nationality: null,
          accessibilityNeeds: [],
          hotelPlaceId: null,
          travelFrom: null,
          travelTo: null,
        })
        .where(eq(users.id, userId));
    });
  }
}
