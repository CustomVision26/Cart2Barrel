import type { Order, OrderItem } from "@/db/schema";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

const CUSTOMER_LINE_REFUND_FULFILLMENTS: OrderItem["fulfillmentStatus"][] = [
  "paid_pending_company_purchase",
  "company_purchase_pending_delivery",
  "delivery_requested_pending_fulfillment",
  "delivery_received_good_awaiting_barrel",
  "delivery_received_item_missing",
  "delivery_received_item_damaged",
  "delivery_received_wrong_item",
  "product_return_awaiting_delivery",
];

export function orderLineFulfillmentAllowsRefundWorkflow(
  orderItem: OrderItemReadCore,
  order: Pick<Order, "status">,
): boolean {
  const f = effectiveOrderItemFulfillmentStatus(orderItem, order);
  return CUSTOMER_LINE_REFUND_FULFILLMENTS.includes(f);
}

export function refundableLineRemainderCents(
  linePriceCents: number,
  refundedCents: number,
): number {
  return Math.max(0, linePriceCents - refundedCents);
}

export function parseUsdDecimalToCents(input: string | undefined): number | null {
  if (input === undefined || !input.trim()) return null;
  const normalized = input.replace(/[$,\s]/g, "").trim();
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  return cents >= 1 ? cents : null;
}
