import { and, eq, exists, ne, not, or, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemProductReturnRequests, orderItems } from "@/db/schema";
import { DELIVERY_RECEIVED_FULFILLMENT_STATUSES } from "@/lib/warehouse-receipt-queue";

/** Fulfilled customer return where the shopper chose money back. */
export function fulfilledMoneyBackProductReturnExists(): SQL {
  const db = getDb();
  return exists(
    db
      .select({ id: orderItemProductReturnRequests.id })
      .from(orderItemProductReturnRequests)
      .where(
        and(
          eq(orderItemProductReturnRequests.orderItemId, orderItems.id),
          eq(orderItemProductReturnRequests.status, "fulfilled"),
          eq(orderItemProductReturnRequests.desiredOutcome, "money_back"),
        )!,
      ),
  );
}

/**
 * `/admin/orders`: pre-purchase ops, pending return requests, and money-back returns awaiting refund.
 * Replacement returns in transit (`returned:awaiting delivery`) belong on purchase orders.
 */
export function applyAdminOrdersQueueFulfillmentWhere(paidWhere: SQL): SQL {
  let w = paidWhere;
  w = and(w, ne(orderItems.fulfillmentStatus, "company_purchase_pending_delivery"))!;
  w = and(
    w,
    ne(orderItems.fulfillmentStatus, "delivery_requested_pending_fulfillment"),
  )!;
  for (const status of DELIVERY_RECEIVED_FULFILLMENT_STATUSES) {
    w = and(w, ne(orderItems.fulfillmentStatus, status))!;
  }
  w = and(
    w,
    or(
      ne(orderItems.fulfillmentStatus, "product_return_awaiting_delivery"),
      fulfilledMoneyBackProductReturnExists(),
    )!,
  )!;
  return w;
}

/** Replacement (or staff) return in transit — not money-back return awaiting refund. */
export function productReturnAwaitingDeliveryOnPurchaseOrders(): SQL {
  return and(
    eq(orderItems.fulfillmentStatus, "product_return_awaiting_delivery"),
    not(fulfilledMoneyBackProductReturnExists()),
  )!;
}
