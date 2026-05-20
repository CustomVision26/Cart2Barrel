import type { AdminRequestQueueKind } from "@/data/admin-item-requests";
import type {
  BatchQuoteSession,
  BatchQuoteSessionEventKind,
  ItemRequest,
  Order,
  OrderItem,
} from "@/db/schema";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";
import { isDeliveryConditionAcceptedForBarrel } from "@/lib/delivery-condition-acceptance";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

/** Order line fulfillment → badge palette. */
export function orderItemFulfillmentBadgeKind(
  orderItem: OrderItemReadCore,
  order: Pick<Order, "status">,
  extras?: {
    pendingRefundRequest?: boolean;
    pendingProductReturnRequest?: boolean;
    fulfillmentOverride?: OrderItem["fulfillmentStatus"];
  },
): StatusBadgeKind {
  if (extras?.pendingRefundRequest) {
    return "refundPendingApproval";
  }
  if (extras?.pendingProductReturnRequest) {
    return "companyPurchasePendingDelivery";
  }
  const f =
    extras?.fulfillmentOverride ??
    effectiveOrderItemFulfillmentStatus(orderItem, order);
  if (isDeliveryConditionAcceptedForBarrel(f, orderItem.warehouseReceivedCondition)) {
    return orderItem.warehouseReceivedCondition === "damaged" ?
        "partialReceived"
      : "customerResend";
  }
  switch (f) {
    case "paid_pending_company_purchase":
      return "awaitingPurchase";
    case "company_purchase_pending_delivery":
      return "companyPurchasePendingDelivery";
    case "delivery_requested_pending_fulfillment":
      return "companyPurchasePendingDelivery";
    case "delivery_received_good_awaiting_barrel":
      return "fullyReceived";
    case "in_barrel_awaiting_shipping":
      return "fullyReceived";
    case "delivery_received_item_missing":
      return "missingItem";
    case "delivery_received_item_damaged":
      return "partialReceived";
    case "delivery_received_wrong_item":
      return "customerResend";
    case "product_return_awaiting_delivery":
      return "companyPurchasePendingDelivery";
    case "refunded":
      return "refunded";
    case "pending_payment":
      return "awaitingPurchase";
    case "paid_outside_purchase_service_fee":
      return "fullyReceived";
    default: {
      const _exhaustive: never = f;
      return _exhaustive;
    }
  }
}

/** Product request `item_requests.status` (shopper / staff lists). */
export function itemRequestWorkflowBadgeKind(
  status: ItemRequest["status"],
): StatusBadgeKind {
  switch (status) {
    case "pending":
      return "newRequest";
    case "quoted":
      return "quoted";
    case "approved":
      return "inCart";
    case "rejected":
      return "missingItem";
    case "withdrawn":
      return "deletedFromCart";
    case "out_of_stock":
      return "outOfStock";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Admin quote history: combines item request workflow with optional order header state
 * when the line is approved onto an order.
 */
export function adminItemRequestOrderBadgeKind(
  status: ItemRequest["status"],
  orderStatus: Order["status"] | null,
): StatusBadgeKind {
  if (status !== "approved") {
    return itemRequestWorkflowBadgeKind(status);
  }
  if (!orderStatus) {
    return "inCart";
  }
  switch (orderStatus) {
    case "pending":
      return "awaitingPurchase";
    case "paid":
      return "awaitingPurchase";
    case "purchasing":
      return "neutral";
    case "completed":
      return "fullyReceived";
    default: {
      const _exhaustive: never = orderStatus;
      return _exhaustive;
    }
  }
}

/** Batch quote session lifecycle (owner dashboard). */
export function batchQuoteSessionBadgeKind(
  status: BatchQuoteSession["status"],
): StatusBadgeKind {
  switch (status) {
    case "draft":
      return "draft";
    case "submitted":
      return "newRequest";
    case "estimated":
      return "quoted";
    case "in_cart":
      return "inCart";
    case "paid_pending_staff_purchase":
      return "awaitingPurchase";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Log entries in customer batch history timeline. */
export function batchQuoteSessionEventBadgeKind(
  kind: BatchQuoteSessionEventKind,
): StatusBadgeKind {
  switch (kind) {
    case "new_batch_request":
      return "newRequest";
    case "revision_reopened":
      return "customerResend";
    case "quoted_batch":
    case "returned_to_quoted_batch":
      return "quoted";
    case "in_cart":
      return "inCart";
    case "paid_pending_staff_purchase":
      return "awaitingPurchase";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Admin item request queue tab (new vs resend vs quoted acceptance). */
export function adminRequestQueueKindBadgeKind(
  kind: AdminRequestQueueKind,
): StatusBadgeKind {
  if (kind === "new") return "newRequest";
  if (kind === "resend") return "customerResend";
  return "quoted";
}
