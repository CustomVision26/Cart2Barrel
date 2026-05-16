import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerItems, orders } from "@/db/schema";
import { mergeRestoredContainerOrderLinesIntoUserCart } from "@/data/user-container-cart";

/**
 * Deletes a pending order owned by `clerkUserId` and merges any reserved container lines
 * back into the shopper cart.
 */
export async function deletePendingOrderAndRestoreContainerCart(
  orderId: string,
  clerkUserId: string,
): Promise<boolean> {
  const db = getDb();
  const [order] = await db
    .select({ id: orders.id, clerkUserId: orders.clerkUserId })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "pending"),
        eq(orders.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  if (!order) return false;

  const oc = await db
    .select({
      containerOfferingId: orderContainerItems.containerOfferingId,
      quantity: orderContainerItems.quantity,
    })
    .from(orderContainerItems)
    .where(eq(orderContainerItems.orderId, orderId));

  const deletedRows = await db
    .delete(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "pending"),
        eq(orders.clerkUserId, clerkUserId),
      ),
    )
    .returning({ id: orders.id });

  if (deletedRows.length > 0 && oc.length > 0) {
    await mergeRestoredContainerOrderLinesIntoUserCart(order.clerkUserId, oc);
  }
  return deletedRows.length > 0;
}
