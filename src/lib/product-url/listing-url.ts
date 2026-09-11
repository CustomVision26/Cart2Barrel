/** Google Shopping / Immersive often returns google.com/search?ibp=oshop links, not the retailer page. */
export function isGoogleHostedProductUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, "");
    return host === "google.com" || host.endsWith(".google.com") || host.includes("google.");
  } catch {
    return false;
  }
}

/** Prefer the retailer product page over a Google Shopping search URL. */
export function preferDirectRetailerUrl(
  link: string | null | undefined,
  productLink: string | null | undefined,
): string | null {
  const candidates = [productLink, link]
    .map((u) => u?.trim())
    .filter((u): u is string => Boolean(u && /^https:\/\//i.test(u)));
  return candidates.find((u) => !isGoogleHostedProductUrl(u)) ?? null;
}

export function listingUrlMatchesRetailer(
  originalHost: string,
  candidateUrl: string,
): boolean {
  if (isGoogleHostedProductUrl(candidateUrl)) return false;
  try {
    const hitHost = new URL(candidateUrl).hostname.toLowerCase().replace(/^www\./, "");
    const orig = originalHost.toLowerCase().replace(/^www\./, "");
    const origStem = orig.split(".")[0] ?? "";
    const hitStem = hitHost.split(".")[0] ?? "";
    return (
      hitHost === orig ||
      hitHost.endsWith(`.${orig}`) ||
      orig.endsWith(`.${hitHost}`) ||
      (origStem.length >= 4 && hitStem.includes(origStem)) ||
      (hitStem.length >= 4 && origStem.includes(hitStem))
    );
  } catch {
    return false;
  }
}
