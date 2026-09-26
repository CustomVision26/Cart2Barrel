import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { barrels, orderContainerItems, orders } from "@/db/schema";
import { isMissingOrderContainerPackagingFeeColumnError } from "@/lib/db-column-missing";

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

  let lines: { id: string; quantity: number }[] = [];
  try {
    lines = await db
      .select({
        id: orderContainerItems.id,
        quantity: orderContainerItems.quantity,
      })
      .from(orderContainerItems)
      .where(eq(orderContainerItems.orderId, orderId));
  } catch (e) {
    if (isMissingOrderContainerPackagingFeeColumnError(e)) {
      console.warn(
        "[ensureBarrelsProvisionedForPaidOrder] order_container_items packing columns missing; skip",
        orderId,
      );
      return;
    }
    throw e;
  }

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
    try {
      await ensureBarrelsProvisionedForPaidOrder(o.id);
    } catch (e) {
      console.error(
        "[ensureBarrelsProvisionedForUser] skip order",
        o.id,
        e,
      );
    }
  }
}
