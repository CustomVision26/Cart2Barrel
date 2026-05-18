import type { ItemRequest } from "@/db/schema";
import {
  isOutsidePurchaseRequest,
  outsidePurchaseReferenceDisplay,
} from "@/lib/outside-purchase";

/** Hostname from a product page URL (lowercase, no leading www.). */
export function hostnameFromProductUrl(productUrl: string): string | null {
  try {
    const u = new URL(productUrl.trim());
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

/** Prefer stored retailer/site label; fall back to hostname from the URL. */
export function displaySiteName(
  siteName: string | null | undefined,
  productUrl: string
): string {
  const s = siteName?.trim();
  if (s) return s;
  return hostnameFromProductUrl(productUrl) ?? "—";
}

/** Site column for item requests, including outside-purchase reference lines. */
export function displayProductSiteName(
  request: Pick<
    ItemRequest,
    "siteName" | "productUrl" | "source" | "outsidePurchaseReference"
  >,
): string {
  if (isOutsidePurchaseRequest(request)) {
    const ref = outsidePurchaseReferenceDisplay(request);
    return ref ? `Outside purchase · ${ref}` : "Outside purchase";
  }
  return displaySiteName(request.siteName, request.productUrl);
}
