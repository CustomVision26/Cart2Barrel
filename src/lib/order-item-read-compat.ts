import type { Order, OrderItem } from "@/db/schema";

/**
 * Columns present before migration 0009 (`fulfillment_status`). Used for reads so the UI
 * works when migrations lag; after 0009 applies, optionally merge `fulfillmentStatus` from DB.
 */
export type OrderItemReadCore = Pick<
  OrderItem,
  "id" | "orderId" | "itemRequestId" | "quantity" | "price"
> & {
  fulfillmentStatus?: OrderItem["fulfillmentStatus"];
  companyPurchaseTrackingUrl?: string | null;
  companyPurchaseRetailerTrackingCompany?: string | null;
  companyPurchaseRetailerTrackingNumber?: string | null;
  companyPurchaseReceiptImageUrls?: string[] | null;
  companyPurchaseInboundMethod?: OrderItem["companyPurchaseInboundMethod"];
  storePickupAt?: OrderItem["storePickupAt"];
  warehouseReceivedAt?: OrderItem["warehouseReceivedAt"];
  warehouseReceivedQty?: OrderItem["warehouseReceivedQty"];
  warehouseReceivedCondition?: OrderItem["warehouseReceivedCondition"];
  warehouseReceivedMissingReason?: OrderItem["warehouseReceivedMissingReason"];
  warehouseReceivedConditionNotes?: OrderItem["warehouseReceivedConditionNotes"];
  warehouseShelfLocation?: OrderItem["warehouseShelfLocation"];
  warehouseReceivedBarcode?: OrderItem["warehouseReceivedBarcode"];
  warehouseReceivedBarcodeImageUrl?: OrderItem["warehouseReceivedBarcodeImageUrl"];
  warehouseReceivedProofPhotoCount?: OrderItem["warehouseReceivedProofPhotoCount"];
  warehouseReceivedProofPhotoUrls?: OrderItem["warehouseReceivedProofPhotoUrls"];
  warehouseReceivedByClerkUserId?: OrderItem["warehouseReceivedByClerkUserId"];
  companyPurchaseUpdatedByClerkUserId?: OrderItem["companyPurchaseUpdatedByClerkUserId"];
};

export function effectiveOrderItemFulfillmentStatus(
  row: Pick<OrderItemReadCore, "fulfillmentStatus">,
  order: Pick<Order, "status">,
): OrderItem["fulfillmentStatus"] {
  /** Lines still on the default after checkout if fulfillment update failed or lagged. */
  if (
    order.status === "paid" &&
    row.fulfillmentStatus === "pending_payment"
  ) {
    return "paid_pending_company_purchase";
  }
  if (row.fulfillmentStatus != null) {
    return row.fulfillmentStatus;
  }
  if (order.status === "paid") {
    return "paid_pending_company_purchase";
  }
  return "pending_payment";
}
