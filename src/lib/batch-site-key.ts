import { hostnameFromProductUrl } from "@/lib/site-name";

/**
 * Stable key for batching quoted lines: hostname when possible, else normalized site label.
 * Used to require same-retailer batches and guard mixed-site checkbox selections.
 */
export function canonicalBatchSiteKey(siteName: string | null | undefined, productUrl: string): string {
  const host = hostnameFromProductUrl(productUrl);
  if (host) return host;
  const s = siteName?.trim().toLowerCase();
  if (s) return s;
  return "unknown_site";
}
