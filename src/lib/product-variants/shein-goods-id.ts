/** Numeric goods id from SHEIN product URLs (`…-p-46954221.html` or `goods-p-123.html`). */
export function parseSheinGoodsId(productUrl: string): string | null {
  try {
    const { pathname } = new URL(productUrl.trim());
    const dashed = pathname.match(/-p-(\d+)\.html/i)?.[1]?.trim();
    if (dashed) return dashed;
    const goods = pathname.match(/\/goods-p-(\d+)\.html/i)?.[1]?.trim();
    return goods || null;
  } catch {
    return null;
  }
}

/** Human title from the SEO slug in a SHEIN product URL path. */
export function parseSheinListingTitleFromUrl(productUrl: string): string | null {
  try {
    let slug = new URL(productUrl.trim()).pathname.split("/").filter(Boolean).pop() ?? "";
    slug = slug.replace(/\.html$/i, "");
    slug = slug.replace(/-p-\d+$/i, "");
    slug = slug.replace(/-cat-\d+$/i, "");
    if (!slug || slug === "goods") return null;
    const title = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    return title.length >= 3 ? title : null;
  } catch {
    return null;
  }
}

const SHEIN_TITLE_STOP = new Set([
  "shein",
  "the",
  "and",
  "for",
  "with",
  "from",
  "www",
  "com",
]);

/** Distinct tokens from a listing title or slug (for Google Shopping match scoring). */
export function sheinListingTitleTokens(title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of title.toLowerCase().split(/[^a-z0-9]+/)) {
    const w = raw.trim();
    if (w.length < 3 || SHEIN_TITLE_STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** Count shared significant tokens between the pasted URL slug and a shopping hit title. */
export function sheinListingTitleOverlap(listingTitle: string, hitTitle: string): number {
  const tokens = sheinListingTitleTokens(listingTitle).filter((w) => w.length >= 4);
  if (tokens.length === 0) {
    return sheinListingTitleTokens(listingTitle).filter((w) =>
      hitTitle.toLowerCase().includes(w),
    ).length;
  }
  const hay = hitTitle.toLowerCase();
  return tokens.filter((t) => hay.includes(t)).length;
}

/** Generic SHEIN baby-apparel words — weak alone for product identity. */
const SHEIN_COMMON_PRODUCT_TOKENS = new Set([
  "newborn",
  "baby",
  "girl",
  "boy",
  "summer",
  "casual",
  "green",
  "floral",
  "romper",
  "print",
  "outfit",
  "cute",
  "set",
  "pcs",
  "piece",
  "clothing",
  "infant",
]);

/** Distinctive tokens from the pasted URL slug (e.g. "ditsy", "hello"). */
export function sheinDistinctiveListingTokens(title: string): string[] {
  return sheinListingTitleTokens(title).filter(
    (w) => w.length >= 4 && !SHEIN_COMMON_PRODUCT_TOKENS.has(w),
  );
}

/** Whether a shopping hit includes the slug's distinctive tokens (e.g. "ditsy"). */
export function sheinHitMatchesDistinctiveTokens(
  listingTitle: string,
  hitTitle: string,
): boolean {
  const distinctive = sheinDistinctiveListingTokens(listingTitle);
  if (distinctive.length === 0) return true;
  const hay = hitTitle.toLowerCase();
  return distinctive.every((t) => hay.includes(t));
}
