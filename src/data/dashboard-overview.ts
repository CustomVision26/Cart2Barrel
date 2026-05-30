import { and, count, countDistinct, eq, inArray, isNotNull, or } from "drizzle-orm";

import { getUserCartHeaderCount } from "@/data/cart-header-count";
import { getDb } from "@/db";
import {
  barrels,
  itemRequests,
  orderItemProductReturnRequests,
  orderItemRefundRequests,
  orderItems,
  orders,
} from "@/db/schema";
import {
  DASHBOARD_AWAITING_INBOUND_FULFILLMENTS,
  DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS,
} from "@/lib/dashboard-overview-line-filters";
import {
  isMissingOrderItemProductReturnRequestsTableError,
  isMissingProductReturnDesiredOutcomeColumnError,
} from "@/lib/db-column-missing";

export type DashboardOverviewStats = {
  cartItemCount: number;
  quotedProductCount: number;
  paidOrderCount: number;
  barrelCount: number;
  awaitingInboundProductCount: number;
  needCorrectionsProductCount: number;
};

async function countAwaitingInboundProductsForOwner(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  try {
    const [row] = await db
      .select({ c: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.clerkUserId, clerkUserId),
          eq(orders.status, "paid"),
          inArray(
            orderItems.fulfillmentStatus,
            [...DASHBOARD_AWAITING_INBOUND_FULFILLMENTS],
          ),
        )!,
      );
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

async function countNeedCorrectionsProductsForOwner(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  const receiptCorrection = inArray(
    orderItems.fulfillmentStatus,
    [...DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS],
  );

  try {
    const [row] = await db
      .select({ c: countDistinct(orderItems.id) })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(
        orderItemRefundRequests,
        and(
          eq(orderItemRefundRequests.orderItemId, orderItems.id),
          eq(orderItemRefundRequests.status, "pending_approval"),
        )!,
      )
      .leftJoin(
        orderItemProductReturnRequests,
        and(
          eq(orderItemProductReturnRequests.orderItemId, orderItems.id),
          eq(orderItemProductReturnRequests.status, "submitted"),
        )!,
      )
      .where(
        and(
          eq(orders.clerkUserId, clerkUserId),
          eq(orders.status, "paid"),
          or(
            isNotNull(orderItemRefundRequests.id),
            isNotNull(orderItemProductReturnRequests.id),
            receiptCorrection,
          ),
        )!,
      );
    return Number(row?.c ?? 0);
  } catch (e) {
    if (
      isMissingOrderItemProductReturnRequestsTableError(e) ||
      isMissingProductReturnDesiredOutcomeColumnError(e)
    ) {
      const [row] = await db
        .select({ c: countDistinct(orderItems.id) })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(
          orderItemRefundRequests,
          and(
            eq(orderItemRefundRequests.orderItemId, orderItems.id),
            eq(orderItemRefundRequests.status, "pending_approval"),
          )!,
        )
        .where(
          and(
            eq(orders.clerkUserId, clerkUserId),
            eq(orders.status, "paid"),
            or(isNotNull(orderItemRefundRequests.id), receiptCorrection),
          )!,
        );
      return Number(row?.c ?? 0);
    }
    return 0;
  }
}

export async function getDashboardOverviewStats(
  clerkUserId: string,
): Promise<DashboardOverviewStats> {
  const db = getDb();

  const [
    cartItemCount,
    quotedRow,
    paidOrdersRow,
    barrelRow,
    awaitingInboundProductCount,
    needCorrectionsProductCount,
  ] = await Promise.all([
    getUserCartHeaderCount(clerkUserId),
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
    countAwaitingInboundProductsForOwner(clerkUserId),
    countNeedCorrectionsProductsForOwner(clerkUserId),
  ]);

  return {
    cartItemCount,
    quotedProductCount: Number(quotedRow[0]?.c ?? 0),
    paidOrderCount: Number(paidOrdersRow[0]?.c ?? 0),
    barrelCount: Number(barrelRow[0]?.c ?? 0),
    awaitingInboundProductCount,
    needCorrectionsProductCount,
  };
}

