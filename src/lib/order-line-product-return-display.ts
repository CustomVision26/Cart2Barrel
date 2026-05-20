import type { OrderItem } from "@/db/schema";
import type { FulfilledProductReturnRequestBrief } from "@/data/order-item-product-return-requests";
import {
  PRODUCT_RETURN_AWAITING_DELIVERY_LABEL,
  PRODUCT_RETURN_AWAITING_REFUND_LABEL,
  PRODUCT_RETURN_REFUNDED_LABEL,
  PRODUCT_RETURN_REQUEST_PENDING_LABEL,
} from "@/lib/product-return-request-labels";
import type { ProductReturnDesiredOutcome } from "@/lib/product-return-desired-outcome";

export type OrderLineProductReturnDisplayInput = {
  fulfillmentStatus: OrderItem["fulfillmentStatus"];
  pendingProductReturnRequest?: boolean;
  fulfilledProductReturnRequest?: FulfilledProductReturnRequestBrief | null;
  refundedCents?: number;
  linePriceCents?: number;
};

export function isMoneyBackProductReturn(
  outcome: ProductReturnDesiredOutcome | null | undefined,
): boolean {
  return outcome === "money_back";
}

/** Customer chose return-for-refund and staff saved return tracking. */
export function isMoneyBackReturnAwaitingRefund(
  input: OrderLineProductReturnDisplayInput,
): boolean {
  return (
    input.fulfillmentStatus === "product_return_awaiting_delivery" &&
    isMoneyBackProductReturn(input.fulfilledProductReturnRequest?.desiredOutcome)
  );
}

/** Money-back return workflow with the line fully reimbursed. */
export function isMoneyBackReturnFullyRefunded(
  input: OrderLineProductReturnDisplayInput,
): boolean {
  if (!isMoneyBackProductReturn(input.fulfilledProductReturnRequest?.desiredOutcome)) {
    return false;
  }
  const linePrice = input.linePriceCents ?? 0;
  const refunded = input.refundedCents ?? 0;
  return (
    input.fulfillmentStatus === "refunded" &&
    linePrice > 0 &&
    refunded >= linePrice
  );
}

export function orderLineProductReturnStatusLabel(
  input: OrderLineProductReturnDisplayInput,
): string | null {
  if (input.pendingProductReturnRequest) {
    return PRODUCT_RETURN_REQUEST_PENDING_LABEL;
  }
  if (isMoneyBackReturnFullyRefunded(input)) {
    return PRODUCT_RETURN_REFUNDED_LABEL;
  }
  if (isMoneyBackReturnAwaitingRefund(input)) {
    return PRODUCT_RETURN_AWAITING_REFUND_LABEL;
  }
  return null;
}

/** Admin may issue Stripe refund only after return tracking is saved for money-back returns. */
export function adminMayRefundLineAfterProductReturn(
  input: OrderLineProductReturnDisplayInput,
): boolean {
  if (input.fulfillmentStatus !== "product_return_awaiting_delivery") {
    return true;
  }
  const fulfilled = input.fulfilledProductReturnRequest;
  if (!fulfilled) {
    return true;
  }
  return isMoneyBackProductReturn(fulfilled.desiredOutcome);
}

/** Replacement returns keep legacy in-transit label after tracking is saved. */
export function productReturnInTransitLabel(
  fulfilledProductReturnRequest?: FulfilledProductReturnRequestBrief | null,
): string {
  if (isMoneyBackProductReturn(fulfilledProductReturnRequest?.desiredOutcome)) {
    return PRODUCT_RETURN_AWAITING_REFUND_LABEL;
  }
  return PRODUCT_RETURN_AWAITING_DELIVERY_LABEL;
}
