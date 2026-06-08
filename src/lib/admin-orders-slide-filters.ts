import type { PaidOrderLineListRow } from "@/data/paid-orders-queries";
import {
  DASHBOARD_AWAITING_INBOUND_FULFILLMENTS,
  DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS,
} from "@/lib/dashboard-overview-line-filters";
import { groupPaidRowsStableByOrder } from "@/lib/partition-paid-order-batch-groups";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { isMoneyBackReturnAwaitingRefund } from "@/lib/order-line-product-return-display";
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

export type OrderLaneAudience = "customer" | "admin";

/** Default lane rules for customer dashboard carousels. */
export const ORDER_SLIDE_LANE_AUDIENCE: OrderLaneAudience = "customer";

function lineRefundable(row: PaidOrderLineListRow): boolean {
  return Math.max(0, row.orderItem.price - row.refundedCents) > 0;
}

/** Paid lines in transit to the warehouse (company purchase recorded). */
export function lineAwaitingInbound(row: PaidOrderLineListRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (
    !DASHBOARD_AWAITING_INBOUND_FULFILLMENTS.includes(
      fulfillment as (typeof DASHBOARD_AWAITING_INBOUND_FULFILLMENTS)[number],
    )
  ) {
    return false;
  }
  return lineRefundable(row);
}

/** Return submitted or money-back return in transit awaiting retailer refund. */
function lineAwaitingReturnStaffAction(row: PaidOrderLineListRow): boolean {
  if (row.pendingProductReturnRequest != null) return true;
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  return isMoneyBackReturnAwaitingRefund({
    fulfillmentStatus: fulfillment,
    fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
  });
}

/** Lines awaiting company purchase (Review and approve). */
export function lineAwaitingPurchase(
  row: PaidOrderLineListRow,
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): boolean {
  if (!lineRefundable(row)) return false;

  if (audience === "customer" && lineAwaitingReturnStaffAction(row)) {
    return true;
  }

  if (isOutsidePurchaseRequest(row.request)) return false;
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (fulfillment === "refunded" || fulfillment === "pending_payment") {
    return false;
  }
  return fulfillment === "paid_pending_company_purchase";
}

/** Problem warehouse receipts that need customer or staff follow-up. */
export function lineNeedsReceiptCorrection(row: PaidOrderLineListRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (
    !DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS.includes(
      fulfillment as (typeof DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS)[number],
    )
  ) {
    return false;
  }
  const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
  return refundable > 0;
}

/** Refund, inbound, return (admin), or receipt-correction lines awaiting action. */
export function lineNeedsCorrection(
  row: PaidOrderLineListRow,
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): boolean {
  if (audience === "customer") {
    return (
      row.pendingRefundRequest != null ||
      lineNeedsReceiptCorrection(row) ||
      lineAwaitingInbound(row)
    );
  }
  return (
    row.pendingRefundRequest != null ||
    row.pendingProductReturnRequest != null ||
    lineNeedsReceiptCorrection(row)
  );
}

/**
 * Customer-funded paid lines that are not awaiting purchase and not in the corrections queue.
 */
export function lineFunded(
  row: PaidOrderLineListRow,
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): boolean {
  if (row.order.status !== "paid") return false;
  const fulfillment = effectiveOutsidePurchasePaidFulfillment(
    row.request,
    row.orderItem,
    row.order,
  );
  if (fulfillment === "pending_payment") return false;
  return (
    !lineAwaitingPurchase(row, audience) && !lineNeedsCorrection(row, audience)
  );
}

function orderMatchesLane(
  lines: PaidOrderLineListRow[],
  lane: OrdersSlideLane,
  audience: OrderLaneAudience,
): boolean {
  switch (lane) {
    case "awaiting_purchase":
      return lines.some((line) => lineAwaitingPurchase(line, audience));
    case "need_corrections":
      return lines.some((line) => lineNeedsCorrection(line, audience));
    case "funded":
      return lines.some((line) => lineFunded(line, audience));
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
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): OrderSlideGroup[] {
  const groups = groupPaidRowsStableByOrder(rows).filter(({ lines }) =>
    orderMatchesLane(lines, lane, audience),
  );
  return [...groups].sort(
    (a, b) =>
      new Date(b.order.createdAt).getTime() -
      new Date(a.order.createdAt).getTime(),
  );
}

const ORDER_SLIDE_LANE_ORDER: OrdersSlideLane[] = [
  "awaiting_purchase",
  "funded",
  "need_corrections",
];

function laneTitleForLane(lane: OrdersSlideLane): string {
  switch (lane) {
    case "awaiting_purchase":
      return "Waiting for purchase";
    case "funded":
      return "In progress";
    case "need_corrections":
      return "Corrections & requests";
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

/** Comma-separated lane names for page intros, e.g. "Waiting for purchase, In progress, and Corrections & requests". */
export function orderSlideLaneNamesList(
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): string {
  const names = ORDER_SLIDE_LANE_ORDER.map((lane) => laneTitle(lane, audience));
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function laneTitle(
  lane: OrdersSlideLane,
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): string {
  return laneTitleForLane(lane);
}

export function laneDescription(
  lane: OrdersSlideLane,
  audience: OrderLaneAudience = ORDER_SLIDE_LANE_AUDIENCE,
): string {
  if (audience === "customer") {
    switch (lane) {
      case "awaiting_purchase":
        return "Awaiting company purchase, or a return request awaiting staff action and retailer refund.";
      case "funded":
        return "Paid orders moving through purchase, shipping, and warehouse. Nothing needed from you right now.";
      case "need_corrections":
        return "Inbound shipments, refund requests, and warehouse receipt issues that need your attention.";
      default: {
        const _exhaustive: never = lane;
        return _exhaustive;
      }
    }
  }

  switch (lane) {
    case "awaiting_purchase":
      return "Paid orders with lines that still need review and approve.";
    case "funded":
      return "Paid lines moving through fulfillment — no pending purchase or correction request.";
    case "need_corrections":
      return "Refund or return requests and problem warehouse receipts awaiting staff or customer action.";
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}
