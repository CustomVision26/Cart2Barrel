import type { OrderItem } from "@/db/schema";
import { PRODUCT_RETURN_STATUS_HEADLINE } from "@/lib/product-return-tracking-memo";

export const REFUND_REQUEST_PENDING_APPROVAL_LABEL =
  "Refund requested — awaiting approval";

export function dashboardOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: { pendingRefundRequest?: boolean },
): string {
  if (opts?.pendingRefundRequest) {
    return REFUND_REQUEST_PENDING_APPROVAL_LABEL;
  }
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Awaiting Purchase";
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "delivery_requested_pending_fulfillment":
      return "Delivery requested — pending fulfillment";
    case "delivery_received_good_awaiting_barrel":
      return "Delivery received: good - awaiting barrel";
    case "delivery_received_item_missing":
      return "Delivery received: item missing";
    case "delivery_received_item_damaged":
      return "Delivery received: item damaged";
    case "delivery_received_wrong_item":
      return "Delivery received: wrong item";
    case "product_return_awaiting_delivery":
      return PRODUCT_RETURN_STATUS_HEADLINE;
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Payment pending";
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}

export function adminOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: { pendingRefundRequest?: boolean },
): string {
  if (opts?.pendingRefundRequest) {
    return REFUND_REQUEST_PENDING_APPROVAL_LABEL;
  }
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Awaiting Purchase";
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "delivery_requested_pending_fulfillment":
      return "Delivery requested — pending fulfillment";
    case "delivery_received_good_awaiting_barrel":
      return "Delivery received: good - awaiting barrel";
    case "delivery_received_item_missing":
      return "Delivery received: item missing";
    case "delivery_received_item_damaged":
      return "Delivery received: item damaged";
    case "delivery_received_wrong_item":
      return "Delivery received: wrong item";
    case "product_return_awaiting_delivery":
      return PRODUCT_RETURN_STATUS_HEADLINE;
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Payment pending";
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}
