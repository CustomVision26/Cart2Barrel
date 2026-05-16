import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { barrels, orderContainerItems, orders } from "@/db/schema";

/**
 * Provisions one `barrels` row per purchased container unit from paid checkout. Safe to call
 * repeatedly (fills missing slots only).
 */
export async function ensureBarrelsProvisionedForPaidOrder(
  orderId: string,
): Promise<void> {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      clerkUserId: orders.clerkUserId,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status !== "paid") {
    return;
  }

  const lines = await db
    .select()
    .from(orderContainerItems)
    .where(eq(orderContainerItems.orderId, orderId));

  for (const line of lines) {
    for (let u = 1; u <= line.quantity; u++) {
      const existing = await db
        .select({ id: barrels.id })
        .from(barrels)
        .where(
          and(
            eq(barrels.orderContainerItemId, line.id),
            eq(barrels.unitOrdinal, u),
          )!,
        )
        .limit(1);
      if (existing[0]) {
        continue;
      }
      await db.insert(barrels).values({
        clerkUserId: order.clerkUserId,
        orderContainerItemId: line.id,
        unitOrdinal: u,
        status: "filling",
        capacityPercentage: 0,
      });
    }
  }
}

export async function ensureBarrelsProvisionedForUser(
  clerkUserId: string,
): Promise<void> {
  const db = getDb();
  const paidOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "paid")));

  for (const o of paidOrders) {
    await ensureBarrelsProvisionedForPaidOrder(o.id);
  }
}
