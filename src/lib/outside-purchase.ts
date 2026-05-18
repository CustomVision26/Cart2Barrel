import type { ItemRequest } from "@/db/schema";

const OUTSIDE_PURCHASE_URL_PREFIX = "https://intake.cart2barrel.invalid/outside-purchase/";

/** Staff-facing reference format: OP-YYYYMMDD-XXXX */
export function formatOutsidePurchaseReference(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `OP-${y}${m}${d}-${suffix}`;
}

export function outsidePurchaseProductUrl(reference: string): string {
  const ref = reference.trim();
  return `${OUTSIDE_PURCHASE_URL_PREFIX}${encodeURIComponent(ref)}`;
}

export function isOutsidePurchaseProductUrl(productUrl: string): boolean {
  return productUrl.trim().startsWith(OUTSIDE_PURCHASE_URL_PREFIX);
}

export type OutsidePurchaseRequestLike = Pick<
  ItemRequest,
  "source" | "outsidePurchaseReference" | "productUrl"
>;

export function isOutsidePurchaseRequest(
  row: OutsidePurchaseRequestLike,
): boolean {
  if (row.source === "outside_purchase") return true;
  if (row.outsidePurchaseReference?.trim()) return true;
  return isOutsidePurchaseProductUrl(row.productUrl);
}

export function outsidePurchaseReferenceDisplay(
  row: OutsidePurchaseRequestLike,
): string | null {
  const ref = row.outsidePurchaseReference?.trim();
  if (ref) return ref;
  if (!isOutsidePurchaseProductUrl(row.productUrl)) return null;
  try {
    const u = new URL(row.productUrl.trim());
    const segment = u.pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    return null;
  }
}
