import type { ItemRequest } from "@/db/schema";
import {
  isOutsidePurchaseRequest,
  outsidePurchaseReferenceDisplay,
} from "@/lib/outside-purchase";
import { parseProductUrl } from "@/lib/product-url/retailer-id";

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

/** Human-friendly retailer label for storefront / spotlight cards. */
export function retailerLabelFromProductUrl(productUrl: string): string {
  const parsed = parseProductUrl(productUrl);
  if (parsed) {
    switch (parsed.kind) {
      case "walmart":
        return "Walmart";
      case "amazon":
        return "Amazon";
      case "target":
        return "Target";
      case "ebay":
        return "eBay";
      default:
        break;
    }
  }

  const host = hostnameFromProductUrl(productUrl);
  if (!host) return "Retailer";

  const lower = host.toLowerCase();
  if (lower.includes("temu")) return "Temu";
  if (lower.includes("shein")) return "SHEIN";

  const stem = host.split(".")[0];
  if (!stem) return host;
  if (stem.toLowerCase() === "ebay") return "eBay";
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}
