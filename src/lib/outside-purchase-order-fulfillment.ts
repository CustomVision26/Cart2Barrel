import type { Order, OrderItem } from "@/db/schema";
import {
  effectiveOrderItemFulfillmentStatus,
  type OrderItemReadCore,
} from "@/lib/order-item-read-compat";
import {
  isOutsidePurchaseRequest,
  type OutsidePurchaseRequestLike,
} from "@/lib/outside-purchase";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";

export function isOutsidePurchasePaidServiceFeeFulfillment(
  request: OutsidePurchaseRequestLike,
  order: Pick<Order, "status">,
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
): boolean {
  if (!isOutsidePurchaseRequest(request) || order.status !== "paid") {
    return false;
  }
  return (
    fulfillmentStatus === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID ||
    fulfillmentStatus === "paid_pending_company_purchase"
  );
}

/** Normalizes legacy paid outside-purchase lines to the service-fee fulfillment status. */
export function effectiveOutsidePurchasePaidFulfillment(
  request: OutsidePurchaseRequestLike,
  orderItem: OrderItemReadCore,
  order: Pick<Order, "status">,
): OrderItem["fulfillmentStatus"] {
  const base = effectiveOrderItemFulfillmentStatus(orderItem, order);
  if (isOutsidePurchasePaidServiceFeeFulfillment(request, order, base)) {
    return BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID;
  }
  return base;
}
