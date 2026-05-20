import type { OrderItem } from "@/db/schema";
import type { FulfilledProductReturnRequestBrief } from "@/data/order-item-product-return-requests";
import {
  deliveryConditionAcceptedAwaitingBarrelLabel,
  isDeliveryConditionAcceptedForBarrel,
  isProblemDeliveryReceiptFulfillment,
  problemDeliveryReceiptStatusLabel,
} from "@/lib/delivery-condition-acceptance";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";
import {
  orderLineProductReturnStatusLabel,
  productReturnInTransitLabel,
} from "@/lib/order-line-product-return-display";

export const REFUND_REQUEST_PENDING_APPROVAL_LABEL =
  "Refund requested — awaiting approval";

export type OrderLineStatusLabelOpts = {
  pendingRefundRequest?: boolean;
  pendingProductReturnRequest?: boolean;
  fulfilledProductReturnRequest?: FulfilledProductReturnRequestBrief | null;
  refundedCents?: number;
  linePriceCents?: number;
  warehouseReceivedCondition?: string | null;
};

function warehouseDeliveryStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: OrderLineStatusLabelOpts,
): string | null {
  const accepted = deliveryConditionAcceptedAwaitingBarrelLabel(
    opts?.warehouseReceivedCondition,
  );
  if (
    isDeliveryConditionAcceptedForBarrel(
      fulfillmentStatus,
      opts?.warehouseReceivedCondition,
    ) &&
    accepted
  ) {
    return accepted;
  }
  if (isProblemDeliveryReceiptFulfillment(fulfillmentStatus)) {
    return problemDeliveryReceiptStatusLabel(
      fulfillmentStatus,
      opts?.warehouseReceivedCondition,
    );
  }
  return null;
}

function returnAwareLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: OrderLineStatusLabelOpts,
): string | null {
  return orderLineProductReturnStatusLabel({
    fulfillmentStatus,
    pendingProductReturnRequest: opts?.pendingProductReturnRequest,
    fulfilledProductReturnRequest: opts?.fulfilledProductReturnRequest,
    refundedCents: opts?.refundedCents,
    linePriceCents: opts?.linePriceCents,
  });
}

export function dashboardOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: OrderLineStatusLabelOpts,
): string {
  if (opts?.pendingRefundRequest) {
    return REFUND_REQUEST_PENDING_APPROVAL_LABEL;
  }
  const returnLabel = returnAwareLabel(fulfillmentStatus, opts);
  if (returnLabel) return returnLabel;
  const warehouseLabel = warehouseDeliveryStatusLabel(fulfillmentStatus, opts);
  if (warehouseLabel) return warehouseLabel;
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Awaiting Purchase";
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "delivery_requested_pending_fulfillment":
      return "Delivery requested — pending fulfillment";
    case "delivery_received_good_awaiting_barrel":
      return "Delivery received: good - awaiting barrel";
    case "in_barrel_awaiting_shipping":
      return "In Barrel: awaiting shipping";
    case "delivery_received_item_missing":
      return "Delivery received: item missing";
    case "delivery_received_item_damaged":
      return "Delivery received: item damaged";
    case "delivery_received_wrong_item":
      return "Delivery received: wrong item";
    case "product_return_awaiting_delivery":
      return productReturnInTransitLabel(opts?.fulfilledProductReturnRequest);
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Payment pending";
    case "paid_outside_purchase_service_fee":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}

export function adminOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  opts?: OrderLineStatusLabelOpts,
): string {
  if (opts?.pendingRefundRequest) {
    return REFUND_REQUEST_PENDING_APPROVAL_LABEL;
  }
  const returnLabel = returnAwareLabel(fulfillmentStatus, opts);
  if (returnLabel) return returnLabel;
  const warehouseLabel = warehouseDeliveryStatusLabel(fulfillmentStatus, opts);
  if (warehouseLabel) return warehouseLabel;
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Awaiting Purchase";
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "delivery_requested_pending_fulfillment":
      return "Delivery requested — pending fulfillment";
    case "delivery_received_good_awaiting_barrel":
      return "Delivery received: good - awaiting barrel";
    case "in_barrel_awaiting_shipping":
      return "In Barrel: awaiting shipping";
    case "delivery_received_item_missing":
      return "Delivery received: item missing";
    case "delivery_received_item_damaged":
      return "Delivery received: item damaged";
    case "delivery_received_wrong_item":
      return "Delivery received: wrong item";
    case "product_return_awaiting_delivery":
      return productReturnInTransitLabel(opts?.fulfilledProductReturnRequest);
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Payment pending";
    case "paid_outside_purchase_service_fee":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}
