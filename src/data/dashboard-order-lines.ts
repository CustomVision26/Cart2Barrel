import type { PendingRefundRequestBrief } from "@/data/order-item-refund-requests";
import type { PaidOrdersQueryInput } from "@/lib/paid-orders-list-params";

import type { PaidOrderLinesPageResult } from "@/data/paid-orders-queries";
import { listPaidOrderLinesPage } from "@/data/paid-orders-queries";
import {
  listOrderItemRefundDetailsByOrderItemIds,
  type OrderItemRefundDetail,
} from "@/data/order-item-refunds";

import { type ItemRequest, type OrderItem } from "@/db/schema";
import { type OrderListCore } from "@/data/order-list-select";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

export type DashboardPaidOrderLineRow = {
  orderItem: OrderItemReadCore;
  order: OrderListCore;
  request: ItemRequest;
  refundedCents: number;
  refundDetails: OrderItemRefundDetail[];
  pendingRefundRequest: PendingRefundRequestBrief | null;
  customerEmail: string | null;
  customerFullName: string | null;
  resolvedBatchSessionId: string | null;
  resolvedBatchNumber: string | null;
};

export type DashboardPaidOrderLinesPageResult = Omit<
  PaidOrderLinesPageResult,
  "rows"
> & {
  rows: DashboardPaidOrderLineRow[];
};

/** Paid cart lines visible on `/dashboard/orders` (checkout through post-purchase fulfillment). */
const DASHBOARD_ORDERS_LINE_FULFILLMENTS: OrderItem["fulfillmentStatus"][] = [
  "paid_pending_company_purchase",
  /** Paid checkout before fulfillment column is backfilled (displayed as awaiting purchase). */
  "pending_payment",
  "company_purchase_pending_delivery",
  "delivery_requested_pending_fulfillment",
  "delivery_received_good_awaiting_barrel",
  "in_barrel_awaiting_shipping",
  "delivery_received_item_missing",
  "delivery_received_item_damaged",
  "delivery_received_wrong_item",
  "product_return_awaiting_delivery",
  "paid_outside_purchase_service_fee",
  "refunded",
];

async function withDashboardRefundDetails(
  pack: PaidOrderLinesPageResult,
): Promise<DashboardPaidOrderLinesPageResult> {
  const refundDetailsByOrderItemId = await listOrderItemRefundDetailsByOrderItemIds(
    pack.rows.map((r) => r.orderItem.id),
  );
  const rows: DashboardPaidOrderLineRow[] = pack.rows.map((r) => ({
    orderItem: r.orderItem,
    order: r.order,
    request: r.request,
    refundedCents: r.refundedCents,
    pendingRefundRequest: r.pendingRefundRequest,
    customerEmail: r.customerEmail,
    customerFullName: r.customerFullName,
    resolvedBatchSessionId: r.resolvedBatchSessionId,
    resolvedBatchNumber: r.resolvedBatchNumber,
    refundDetails: refundDetailsByOrderItemId.get(r.orderItem.id) ?? [],
  }));
  return {
    rows,
    totalOrders: pack.totalOrders,
    page: pack.page,
    pageSize: pack.pageSize,
    totalPages: pack.totalPages,
    query: pack.query,
  };
}

/** Paginates by order (paid only), with shared search/sort semantics as `/admin/orders`. */
export async function listDashboardPaidOrderLinesPage(
  clerkUserId: string,
  query: PaidOrdersQueryInput,
): Promise<DashboardPaidOrderLinesPageResult> {
  const pack = await listPaidOrderLinesPage({
    scope: { ownerClerkUserId: clerkUserId },
    query,
    lineFulfillmentIn: DASHBOARD_ORDERS_LINE_FULFILLMENTS,
  });
  return withDashboardRefundDetails(pack);
}

/** Full paid checkout history for a dashboard user, scoped by Clerk user id. */
export async function listDashboardPaidOrderHistoryLinesPage(
  clerkUserId: string,
  query: PaidOrdersQueryInput,
): Promise<DashboardPaidOrderLinesPageResult> {
  const pack = await listPaidOrderLinesPage({
    scope: { ownerClerkUserId: clerkUserId },
    query,
  });
  return withDashboardRefundDetails(pack);
}
