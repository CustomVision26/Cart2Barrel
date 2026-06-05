import {
  orderItems,
  orders,
  type Order,
  type OrderItem,
} from "@/db/schema";

/**
 * Columns loaded for order line list UIs — omits `receipt_email_sent_at` so queries work
 * before migration `0011_order_receipt_and_refunds` is applied.
 */
export const orderListSelect = {
  id: orders.id,
  clerkUserId: orders.clerkUserId,
  status: orders.status,
  totalAmount: orders.totalAmount,
  stripePaymentIntentId: orders.stripePaymentIntentId,
  createdAt: orders.createdAt,
} as const;

export type OrderListCore = Pick<
  Order,
  | "id"
  | "clerkUserId"
  | "status"
  | "totalAmount"
  | "stripePaymentIntentId"
  | "createdAt"
>;

/**
 * Core order line columns for fulfillment / purchase flows (no warehouse receipt columns).
 * Safe before migration `0023_order_items_warehouse_receipt`.
 */
export const orderItemFulfillmentCoreSelect = {
  id: orderItems.id,
  orderId: orderItems.orderId,
  itemRequestId: orderItems.itemRequestId,
  quantity: orderItems.quantity,
  price: orderItems.price,
  fulfillmentStatus: orderItems.fulfillmentStatus,
  companyPurchaseTrackingUrl: orderItems.companyPurchaseTrackingUrl,
  companyPurchaseRetailerTrackingCompany:
    orderItems.companyPurchaseRetailerTrackingCompany,
  companyPurchaseRetailerTrackingNumber:
    orderItems.companyPurchaseRetailerTrackingNumber,
  companyPurchaseReceiptImageUrls: orderItems.companyPurchaseReceiptImageUrls,
} as const;

/** Apply when reading rows that may not have migrated yet (merge onto `orderItemFulfillmentCoreSelect` result). */
export const orderItemWarehouseReceiptNulls = {
  warehouseReceivedAt: null,
  warehouseReceivedQty: null,
  warehouseReceivedCondition: null,
  warehouseReceivedMissingReason: null,
  warehouseShelfLocation: null,
  warehouseReceivedBarcode: null,
  warehouseReceivedBarcodeImageUrl: null,
  warehouseReceivedProofPhotoCount: null,
  warehouseReceivedProofPhotoUrls: null,
} as const;

/**
 * Optional columns from `0023_order_items_warehouse_receipt`. Use with try/catch fallback — see
 * `orderItemFulfillmentCoreSelectWithWarehouse`.
 */
export const orderItemWarehouseReceiptSelect = {
  warehouseReceivedAt: orderItems.warehouseReceivedAt,
  warehouseReceivedQty: orderItems.warehouseReceivedQty,
  warehouseReceivedCondition: orderItems.warehouseReceivedCondition,
  warehouseReceivedMissingReason: orderItems.warehouseReceivedMissingReason,
  warehouseShelfLocation: orderItems.warehouseShelfLocation,
  warehouseReceivedBarcode: orderItems.warehouseReceivedBarcode,
  warehouseReceivedBarcodeImageUrl: orderItems.warehouseReceivedBarcodeImageUrl,
  warehouseReceivedProofPhotoCount: orderItems.warehouseReceivedProofPhotoCount,
  warehouseReceivedProofPhotoUrls: orderItems.warehouseReceivedProofPhotoUrls,
} as const;

/**
 * Optional columns from `0063_admin_recorded_by_clerk_user_id`. Use with try/catch fallback.
 */
export const orderItemAdminUpdatedBySelect = {
  warehouseReceivedByClerkUserId: orderItems.warehouseReceivedByClerkUserId,
  companyPurchaseUpdatedByClerkUserId:
    orderItems.companyPurchaseUpdatedByClerkUserId,
} as const;

/** Merge when migration 0063 is not applied yet. */
export const orderItemAdminUpdatedByNulls = {
  warehouseReceivedByClerkUserId: null,
  companyPurchaseUpdatedByClerkUserId: null,
} as const;

export const orderItemFulfillmentCoreSelectWithWarehouse = {
  ...orderItemFulfillmentCoreSelect,
  ...orderItemWarehouseReceiptSelect,
} as const;

export const orderItemFulfillmentCoreSelectWithWarehouseAndAdminUpdatedBy = {
  ...orderItemFulfillmentCoreSelectWithWarehouse,
  ...orderItemAdminUpdatedBySelect,
} as const;

/** Minimal order line fields for barrel pipeline list queries (avoids selecting full `order_items`). */
export const orderItemBarrelPipelineSelect = {
  id: orderItems.id,
  quantity: orderItems.quantity,
  fulfillmentStatus: orderItems.fulfillmentStatus,
  warehouseReceivedCondition: orderItems.warehouseReceivedCondition,
} as const;

export const orderItemBarrelPipelineSelectWithoutWarehouse = {
  id: orderItems.id,
  quantity: orderItems.quantity,
  fulfillmentStatus: orderItems.fulfillmentStatus,
} as const;

export type OrderItemFulfillmentCore = Pick<
  OrderItem,
  | "id"
  | "orderId"
  | "itemRequestId"
  | "quantity"
  | "price"
  | "fulfillmentStatus"
  | "companyPurchaseTrackingUrl"
  | "companyPurchaseRetailerTrackingCompany"
  | "companyPurchaseRetailerTrackingNumber"
  | "companyPurchaseReceiptImageUrls"
> &
  Partial<
    Pick<
      OrderItem,
      | "warehouseReceivedAt"
      | "warehouseReceivedQty"
      | "warehouseReceivedCondition"
      | "warehouseReceivedMissingReason"
      | "warehouseShelfLocation"
      | "warehouseReceivedBarcode"
      | "warehouseReceivedBarcodeImageUrl"
      | "warehouseReceivedProofPhotoCount"
      | "warehouseReceivedProofPhotoUrls"
      | "warehouseReceivedByClerkUserId"
      | "companyPurchaseUpdatedByClerkUserId"
    >
  >;
