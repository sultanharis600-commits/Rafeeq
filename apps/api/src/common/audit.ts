import type { Tx } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

/** Every admin action is logged (guide: Admin and audit). */
export async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entity?: { type: string; id: string },
  data?: Record<string, unknown>,
): Promise<void> {
  await tx.insert(auditLogs).values({ actorId, action, entityType: entity?.type, entityId: entity?.id, data });
}
