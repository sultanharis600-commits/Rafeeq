import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { providers, staffMembers, users } from '../db/schema.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class AuthUsersService {
  constructor(@InjectDb() private readonly db: Database) {}

  async load(id: string): Promise<AuthUser | null> {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) return null;
    const owned =
      u.role === 'provider_owner'
        ? await this.db.select({ id: providers.id }).from(providers).where(eq(providers.ownerId, id))
        : [];
    const staff =
      u.role === 'staff'
        ? await this.db
            .select({ id: staffMembers.id, providerId: staffMembers.providerId, staffRole: staffMembers.staffRole })
            .from(staffMembers)
            .where(eq(staffMembers.userId, id))
        : [];
    return {
      id: u.id,
      role: u.role,
      language: u.language,
      name: u.name,
      providerIds: owned.map((p) => p.id),
      staff: staff.filter(Boolean),
    };
  }
}
