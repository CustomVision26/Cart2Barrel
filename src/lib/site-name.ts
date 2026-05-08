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
