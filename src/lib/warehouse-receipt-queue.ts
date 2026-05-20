import type { OrderItem } from "@/db/schema";
import { BARREL_PIPELINE_IN_CONTAINER } from "@/lib/barrel-pipeline-fulfillment";

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
 * `/admin/purchase-orders`: inbound coordination, pre-good receipt, problem receipts, and
 * replacement returns in transit (`returned:awaiting delivery`).
 * `delivery_received_good_awaiting_barrel` is excluded — good receipts appear on `/admin/packages`;
 * Customer-accepted damaged/wrong receipts also appear on `/admin/packages` and assign-to-barrel.
 * Money-back returns awaiting refund stay on `/admin/orders`.
 */

/** `/admin/packages`: good receipt awaiting barrel (any warehouse condition) and packed in container. */
export const ADMIN_PACKAGES_QUEUE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  ["delivery_received_good_awaiting_barrel", BARREL_PIPELINE_IN_CONTAINER];
/** Purchase queue statuses excluding replacement return (handled via separate SQL branch). */
export const ADMIN_PURCHASE_ORDERS_QUEUE_BASE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    "company_purchase_pending_delivery",
    "delivery_requested_pending_fulfillment",
    ...DELIVERY_RECEIVED_PROBLEM_FULFILLMENT_STATUSES,
  ];

export const ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    ...ADMIN_PURCHASE_ORDERS_QUEUE_BASE_FULFILLMENT_STATUSES,
    "product_return_awaiting_delivery",
  ];

/**
 * Fulfillment states where hub or shopper may save / correct a warehouse receipt (purchase orders,
 * problem receipts, return awaiting delivery on Orders, or good receipt awaiting barrel on Packages).
 */
export const WAREHOUSE_RECEIPT_SUBMITTABLE_FULFILLMENT_STATUSES: OrderItem["fulfillmentStatus"][] =
  [
    ...ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES,
    ...ADMIN_PACKAGES_QUEUE_FULFILLMENT_STATUSES,
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
