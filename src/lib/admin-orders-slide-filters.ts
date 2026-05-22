import type { PaidOrderLineListRow } from "@/data/paid-orders-queries";
import { groupPaidRowsStableByOrder } from "@/lib/partition-paid-order-batch-groups";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";

export type OrdersSlideLane = "awaiting_purchase" | "funded" | "need_corrections";

/** @deprecated Use `OrdersSlideLane`. */
export type AdminOrdersSlideLane = OrdersSlideLane;

export type OrderSlideGroup = {
  order: PaidOrderLineListRow["order"];
  lines: PaidOrderLineListRow[];
};

/** @deprecated Use `OrderSlideGroup`. */
export type AdminOrderSlideGroup = OrderSlideGroup;

/** Lines awaiting company purchase (Review and approve). */
export function lineAwaitingPurchase(row: PaidOrderLineListRow): boolean {
  if (isOutsidePurchaseRequest(row.request)) return false;
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (
    fulfillment === "refunded" ||
    fulfillment === "pending_payment"
  ) {
    return false;
  }
  const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
  return fulfillment === "paid_pending_company_purchase" && refundable > 0;
}

/** Refund or product-return requests awaiting staff action. */
export function lineNeedsCorrection(row: PaidOrderLineListRow): boolean {
  return (
    row.pendingRefundRequest != null ||
    row.pendingProductReturnRequest != null
  );
}

/**
 * Customer-funded paid lines that are not awaiting purchase and not in the corrections queue.
 */
export function lineFunded(row: PaidOrderLineListRow): boolean {
  if (row.order.status !== "paid") return false;
  const fulfillment = effectiveOutsidePurchasePaidFulfillment(
    row.request,
    row.orderItem,
    row.order,
  );
  if (fulfillment === "pending_payment") return false;
  return !lineAwaitingPurchase(row) && !lineNeedsCorrection(row);
}

function orderMatchesLane(
  lines: PaidOrderLineListRow[],
  lane: OrdersSlideLane,
): boolean {
  switch (lane) {
    case "awaiting_purchase":
      return lines.some(lineAwaitingPurchase);
    case "need_corrections":
      return lines.some(lineNeedsCorrection);
    case "funded":
      return lines.some(lineFunded);
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

/** Newest checkout first within each lane. */
export function groupOrdersForSlideLane(
  rows: PaidOrderLineListRow[],
  lane: OrdersSlideLane,
): OrderSlideGroup[] {
  const groups = groupPaidRowsStableByOrder(rows).filter(({ lines }) =>
    orderMatchesLane(lines, lane),
  );
  return [...groups].sort(
    (a, b) =>
      new Date(b.order.createdAt).getTime() -
      new Date(a.order.createdAt).getTime(),
  );
}

export function laneTitle(lane: OrdersSlideLane): string {
  switch (lane) {
    case "awaiting_purchase":
      return "Awaiting purchase";
    case "funded":
      return "Funded";
    case "need_corrections":
      return "Need corrections";
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

export function laneDescription(lane: OrdersSlideLane): string {
  switch (lane) {
    case "awaiting_purchase":
      return "Paid orders with lines that still need Review and approve.";
    case "funded":
      return "Paid, customer-funded lines with no pending purchase or correction request.";
    case "need_corrections":
      return "Refund or product-return requests awaiting staff approval.";
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}
