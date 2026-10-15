import { eq, sql } from 'drizzle-orm';
import { ORDER_TRANSITIONS, type OrderStatus } from '@rafeeq/shared';
import type { Tx } from '../db/client.js';
import { orderItems, orders, products } from '../db/schema.js';
import { conflict, notFound } from '../common/errors.js';
import { assertTransition, recordStatus } from '../common/status.js';

export type OrderRow = typeof orders.$inferSelect;

export async function lockOrder(tx: Tx, id: string): Promise<OrderRow> {
  const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
  if (!o) throw notFound('order');
  return o;
}

export async function transitionOrder(
  tx: Tx,
  o: OrderRow,
  to: OrderStatus,
  opts: { actorId?: string | null; reason?: string; set?: Partial<typeof orders.$inferInsert> } = {},
): Promise<OrderRow> {
  assertTransition('order', ORDER_TRANSITIONS, o.status, to);
  const [row] = await tx.update(orders).set({ status: to, ...opts.set }).where(eq(orders.id, o.id)).returning();
  await recordStatus(tx, { entityType: 'order', entityId: o.id, from: o.status, to, actorId: opts.actorId, reason: opts.reason });
  return row;
}

/**
 * Reserve stock when an order is paid (guide: Shop build notes). Throws
 * `order.out_of_stock` when any line no longer fits; the caller refunds.
 */
export async function reserveStock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    const res = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${it.quantity}` })
      .where(sql`${products.id} = ${it.productId} and ${products.stock} >= ${it.quantity}`)
      .returning({ id: products.id });
    if (!res.length) throw conflict('order.out_of_stock', 'A product sold out while you were paying', { productId: it.productId });
  }
}

/** Put stock back when a paid order is cancelled. */
export async function releaseStock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${it.quantity}` })
      .where(eq(products.id, it.productId));
  }
}
