import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerItems, orders } from "@/db/schema";
import { mergeRestoredContainerOrderLinesIntoUserCart } from "@/data/user-container-cart";
import { restoreOutboundShippingCartForCharges } from "@/data/barrel-outbound-shipping-charges";

/**
 * Deletes a pending order owned by `clerkUserId` and merges any reserved container lines
 * back into the shopper cart. When `outboundChargeIds` are provided (from the Stripe
 * session metadata), the matching outbound shipping charges are also restored to the cart.
 */
export async function deletePendingOrderAndRestoreContainerCart(
  orderId: string,
  clerkUserId: string,
  outboundChargeIds: string[] = [],
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

  if (deletedRows.length > 0) {
    if (oc.length > 0) {
      await mergeRestoredContainerOrderLinesIntoUserCart(order.clerkUserId, oc);
    }
    if (outboundChargeIds.length > 0) {
      await restoreOutboundShippingCartForCharges(
        order.clerkUserId,
        outboundChargeIds,
      );
    }
  }
  return deletedRows.length > 0;
}
