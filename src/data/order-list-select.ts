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
  warehouseShelfLocation: orderItems.warehouseShelfLocation,
  warehouseReceivedBarcode: orderItems.warehouseReceivedBarcode,
  warehouseReceivedBarcodeImageUrl: orderItems.warehouseReceivedBarcodeImageUrl,
  warehouseReceivedProofPhotoCount: orderItems.warehouseReceivedProofPhotoCount,
  warehouseReceivedProofPhotoUrls: orderItems.warehouseReceivedProofPhotoUrls,
} as const;

export const orderItemFulfillmentCoreSelectWithWarehouse = {
  ...orderItemFulfillmentCoreSelect,
  ...orderItemWarehouseReceiptSelect,
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
      | "warehouseShelfLocation"
      | "warehouseReceivedBarcode"
      | "warehouseReceivedBarcodeImageUrl"
      | "warehouseReceivedProofPhotoCount"
      | "warehouseReceivedProofPhotoUrls"
    >
  >;
