import {
  isRetailerReceiptImageMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";

export function revokeBlobPreviewUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function validateProductImageFile(file: File): string | null {
  if (!isRetailerReceiptImageMime(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    return `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}
