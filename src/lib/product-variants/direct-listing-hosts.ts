import type { ParsedProductUrl } from "@/lib/product-url/retailer-id";

/**
 * Retailers where the shopper pasted a direct product URL.
 * Google Immersive / Shopping prices are often stale or from the wrong listing — use live page data.
 */
export function isDirectListingRetailer(parsed: ParsedProductUrl): boolean {
  const host = parsed.hostname.toLowerCase();
  return (
    parsed.kind === "generic" ||
    parsed.kind === "target" ||
    parsed.kind === "ebay" ||
    host.includes("shein.") ||
    host.includes("temu.")
  );
}
