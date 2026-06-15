import type { FulfilledProductReturnRequestBrief } from "@/data/order-item-product-return-requests";
import type { Order } from "@/db/schema";
import type { OrderLineStatusLabelOpts } from "@/lib/order-fulfillment-labels";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

type WorkflowRequestBrief = { createdAt: string } | null | undefined;

export type OrderLineCurrentStatusInput = {
  orderItem: Pick<
    OrderItemReadCore,
    | "warehouseReceivedAt"
    | "warehouseReceivedCondition"
    | "price"
    | "companyPurchaseInboundMethod"
  >;
  order: Pick<Order, "createdAt">;
  pendingRefundRequest?: WorkflowRequestBrief;
  pendingProductReturnRequest?: WorkflowRequestBrief;
  fulfilledProductReturnRequest?: FulfilledProductReturnRequestBrief | null;
  refundedCents?: number;
};

export function orderLineStatusLabelOpts(
  input: OrderLineCurrentStatusInput,
): OrderLineStatusLabelOpts {
  return {
    pendingRefundRequest: input.pendingRefundRequest != null,
    pendingProductReturnRequest: input.pendingProductReturnRequest != null,
    fulfilledProductReturnRequest: input.fulfilledProductReturnRequest,
    refundedCents: input.refundedCents,
    linePriceCents: input.orderItem.price,
    warehouseReceivedCondition: input.orderItem.warehouseReceivedCondition,
    companyPurchaseInboundMethod: input.orderItem.companyPurchaseInboundMethod,
  };
}

/** Timestamp for the headline status shown on order history cards and timelines. */
export function orderLineCurrentStatusRecordedAt(
  input: OrderLineCurrentStatusInput,
  latestSnapshotAt?: string | null,
): string {
  if (input.pendingRefundRequest?.createdAt) {
    return input.pendingRefundRequest.createdAt;
  }
  if (input.pendingProductReturnRequest?.createdAt) {
    return input.pendingProductReturnRequest.createdAt;
  }
  if (input.fulfilledProductReturnRequest?.fulfilledAt) {
    return input.fulfilledProductReturnRequest.fulfilledAt;
  }
  return (
    input.orderItem.warehouseReceivedAt ??
    latestSnapshotAt ??
    input.order.createdAt
  );
}

export function orderLineCurrentStatusDetail(
  input: OrderLineCurrentStatusInput,
): string {
  if (input.pendingRefundRequest != null) {
    return "A refund request is awaiting staff approval.";
  }
  if (input.pendingProductReturnRequest != null) {
    return "A product return request is awaiting staff review.";
  }
  return "Latest fulfillment status saved on this order line.";
}

export function adminOrderLineCurrentStatusDetail(
  input: OrderLineCurrentStatusInput,
): string {
  if (input.pendingRefundRequest != null) {
    return "A shopper refund request is waiting for staff review.";
  }
  if (input.pendingProductReturnRequest != null) {
    return "A shopper product return request is waiting for staff review.";
  }
  return "Latest fulfillment state currently saved on this product line.";
}
