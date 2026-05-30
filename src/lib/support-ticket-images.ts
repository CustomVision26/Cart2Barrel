import {
  isRetailerReceiptImageMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
  retailerReceiptExtensionForMime,
} from "@/lib/retailer-receipt-images";

/** Max images stored on a single support message. */
export const SUPPORT_TICKET_IMAGES_MAX = 4;

/** Max files per upload request. */
export const SUPPORT_TICKET_UPLOAD_BATCH_MAX = 4;

export {
  isRetailerReceiptImageMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
  retailerReceiptExtensionForMime,
};

export function normalizeSupportTicketImageUrls(
  urls: string[] | null | undefined,
): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, SUPPORT_TICKET_IMAGES_MAX);
}
