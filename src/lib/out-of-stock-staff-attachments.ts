import {
  isRetailerReceiptImageMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
  retailerReceiptExtensionForMime,
} from "@/lib/retailer-receipt-images";

/** Max attachment images stored on an out-of-stock item request. */
export const OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX = 6;

/** Max files per upload request from the mark-out-of-stock dialog. */
export const OUT_OF_STOCK_ATTACHMENT_UPLOAD_BATCH_MAX = 6;

export const OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH = 2000;

export function isOutOfStockAttachmentImageMime(mime: string): boolean {
  return isRetailerReceiptImageMime(mime);
}

export function outOfStockAttachmentExtensionForMime(mime: string): string {
  return retailerReceiptExtensionForMime(mime);
}

export { RETAILER_RECEIPT_IMAGE_MAX_BYTES as OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES };
