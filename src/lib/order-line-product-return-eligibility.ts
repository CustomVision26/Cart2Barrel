import type { Order, OrderItem } from "@/db/schema";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { OutsidePurchaseRequestLike } from "@/lib/outside-purchase";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";

const CUSTOMER_LINE_PRODUCT_RETURN_FULFILLMENTS: OrderItem["fulfillmentStatus"][] =
  [
    "paid_pending_company_purchase",
    "company_purchase_pending_delivery",
    "delivery_requested_pending_fulfillment",
    "delivery_received_good_awaiting_barrel",
    "in_barrel_awaiting_shipping",
    "delivery_received_item_missing",
    "delivery_received_item_damaged",
    "delivery_received_wrong_item",
  ];

export function orderLineFulfillmentAllowsProductReturnRequest(
  orderItem: OrderItemReadCore,
  order: Pick<Order, "status">,
): boolean {
  const f = effectiveOrderItemFulfillmentStatus(orderItem, order);
  return CUSTOMER_LINE_PRODUCT_RETURN_FULFILLMENTS.includes(f);
}

export function dashboardShowsProductReturnButton(input: {
  request: OutsidePurchaseRequestLike;
  orderItem: OrderItemReadCore;
  order: Pick<Order, "status">;
  refundedCents: number;
  pendingProductReturnRequest: boolean;
  pendingRefundRequest: boolean;
}): boolean {
  if (isOutsidePurchaseRequest(input.request)) return false;
  if (input.pendingProductReturnRequest) return false;
  if (input.pendingRefundRequest) return false;
  const f = effectiveOrderItemFulfillmentStatus(input.orderItem, input.order);
  if (f === "product_return_awaiting_delivery" || f === "refunded") {
    return false;
  }
  if (
    refundableLineRemainderCents(input.orderItem.price, input.refundedCents) < 1
  ) {
    return false;
  }
  return orderLineFulfillmentAllowsProductReturnRequest(
    input.orderItem,
    input.order,
  );
}
