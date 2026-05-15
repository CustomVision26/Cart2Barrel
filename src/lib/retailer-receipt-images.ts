import type { Order, OrderItem } from "@/db/schema";
import {
  effectiveOrderItemFulfillmentStatus,
  type OrderItemReadCore,
} from "@/lib/order-item-read-compat";

/** Max images stored per order line (`order_items.company_purchase_receipt_image_urls`). */
export const RETAILER_RECEIPT_IMAGES_MAX = 12;

/** Max files per upload request. */
export const RETAILER_RECEIPT_UPLOAD_BATCH_MAX = 6;

/** Per-file size limit (bytes). */
export const RETAILER_RECEIPT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const MIME_TO_EXT: Record<string, "jpg" | "png" | "webp" | "gif"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isRetailerReceiptImageMime(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function retailerReceiptExtensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "jpg";
}

/** Who may add/remove retailer receipt screenshots for a paid line. */
export function canManageRetailerReceiptImages(
  orderItem: OrderItemReadCore,
  order: Pick<Order, "status">,
): boolean {
  const effective = effectiveOrderItemFulfillmentStatus(orderItem, order);
  return (
    effective === "paid_pending_company_purchase" ||
    effective === "company_purchase_pending_delivery" ||
    effective === "delivery_requested_pending_fulfillment" ||
    effective === "delivery_received_good_awaiting_barrel" ||
    effective === "delivery_received_item_missing" ||
    effective === "delivery_received_item_damaged" ||
    effective === "delivery_received_wrong_item" ||
    effective === "product_return_awaiting_delivery"
  );
}
