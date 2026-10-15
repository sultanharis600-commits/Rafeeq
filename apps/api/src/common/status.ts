import { canTransition } from '@rafeeq/shared';
import type { Tx } from '../db/client.js';
import { statusEvents } from '../db/schema.js';
import { conflict } from './errors.js';

export type EntityType = 'booking' | 'order' | 'bag' | 'lost_alert' | 'lost_bag_case' | 'provider' | 'payment' | 'payout';

/** Throw unless `from → to` is allowed by the status machine. */
export function assertTransition<S extends string>(entity: EntityType, table: Record<S, readonly S[]>, from: S, to: S): void {
  if (!canTransition(table, from, to)) {
    throw conflict(`${entity}.invalid_transition`, `Cannot move ${entity} from ${from} to ${to}`, { from, to });
  }
}

/** Write the status_events row every status change needs (AI_RULES.md). */
export async function recordStatus(
  tx: Tx,
  e: { entityType: EntityType; entityId: string; from: string | null; to: string; actorId?: string | null; reason?: string; at?: Date },
): Promise<void> {
  await tx.insert(statusEvents).values({
    entityType: e.entityType,
    entityId: e.entityId,
    fromStatus: e.from,
    toStatus: e.to,
    actorId: e.actorId ?? null,
    reason: e.reason,
    at: e.at ?? new Date(),
  });
}
