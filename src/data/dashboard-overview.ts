import { and, count, countDistinct, eq, inArray } from "drizzle-orm";

import { countApprovedCartItemsForUser } from "@/data/cart";
import { countPendingRefundRequestsForOwner } from "@/data/order-item-refund-requests";
import { countUserContainerCartLineRows } from "@/data/user-container-cart";
import { getDb } from "@/db";
import { barrels, itemRequests, orders } from "@/db/schema";

export type DashboardOverviewStats = {
  cartItemCount: number;
  quotedProductCount: number;
  paidOrderCount: number;
  barrelCount: number;
  pendingRefundCount: number;
};

export async function getDashboardOverviewStats(
  clerkUserId: string,
): Promise<DashboardOverviewStats> {
  const db = getDb();

  const [
    cartProducts,
    cartContainers,
    quotedRow,
    paidOrdersRow,
    barrelRow,
    pendingRefundCount,
  ] = await Promise.all([
    countApprovedCartItemsForUser(clerkUserId),
    countUserContainerCartLineRows(clerkUserId),
    db
      .select({ c: count() })
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemRequests.status, ["quoted"]),
        ),
      ),
    db
      .select({ c: countDistinct(orders.id) })
      .from(orders)
      .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "paid"))),
    db
      .select({ c: count() })
      .from(barrels)
      .where(eq(barrels.clerkUserId, clerkUserId)),
    countPendingRefundRequestsForOwner(clerkUserId),
  ]);

  return {
    cartItemCount: cartProducts + cartContainers,
    quotedProductCount: Number(quotedRow[0]?.c ?? 0),
    paidOrderCount: Number(paidOrdersRow[0]?.c ?? 0),
    barrelCount: Number(barrelRow[0]?.c ?? 0),
    pendingRefundCount,
  };
}
