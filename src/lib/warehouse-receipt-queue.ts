import type { OrderItem } from "@/db/schema";

/** All hub “delivery received” outcomes on `order_items.fulfillment_status`. */
export const DELIVERY_RECEIVED_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    "delivery_received_good_awaiting_barrel",
    "delivery_received_item_missing",
    "delivery_received_item_damaged",
    "delivery_received_wrong_item",
  ];

/** Problem receipts that stay on `/admin/purchase-orders` until corrected. */
export const DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    "delivery_received_item_missing",
    "delivery_received_item_damaged",
    "delivery_received_wrong_item",
  ];

/**
 * `/admin/purchase-orders`: inbound coordination, pre-good receipt, and problem receipts.
 * `delivery_received_good_awaiting_barrel` is excluded — those lines appear on `/admin/packages` only.
 * `product_return_awaiting_delivery` is listed on `/admin/orders` instead.
 */
export const ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    "company_purchase_pending_delivery",
    "delivery_requested_pending_fulfillment",
    ...DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES,
  ];

/**
 * Fulfillment states where hub or shopper may save / correct a warehouse receipt (purchase orders,
 * problem receipts, return awaiting delivery on Orders, or good receipt awaiting barrel on Packages).
 */
export const WAREHOUSE_RECEIPT_SUBMITTABLE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    ...ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES,
    "delivery_received_good_awaiting_barrel",
    "product_return_awaiting_delivery",
  ];

export function isAdminPurchaseOrdersQueueFulfillment(
  status: OrderItem["fulfillmentStatus"],
): boolean {
  return ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES.includes(status);
}

/** Who may submit / re-submit a warehouse receipt for this fulfillment state. */
export function canSubmitWarehouseReceiptForFulfillment(
  status: OrderItem["fulfillmentStatus"],
): boolean {
  return WAREHOUSE_RECEIPT_SUBMITTABLE_FULFILLMENT_STATUSES.includes(status);
}
