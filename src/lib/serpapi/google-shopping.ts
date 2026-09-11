import { usableRetailerProductImageUrl } from "@/lib/product-variants/variant-images";
import { preferDirectRetailerUrl } from "@/lib/product-url/listing-url";
import { isSerpApiRateLimitError, isSerpApiTransientError, serpApiGet } from "@/lib/serpapi/http";

export type SerpShoppingResult = {
  title: string;
  retailer: string;
  productUrl: string;
  priceUsd: number | null;
  imageUrl: string | null;
  immersiveProductPageToken: string | null;
};

type SerpShoppingRaw = {
  title?: string;
  source?: string;
  link?: string;
  product_link?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  thumbnails?: string[];
  serpapi_thumbnail?: string;
  immersive_product_page_token?: string;
};

function shoppingResultUrl(raw: SerpShoppingRaw): string | null {
  const preferred = preferDirectRetailerUrl(raw.link, raw.product_link);
  if (preferred) return preferred;
  const fallback = raw.product_link?.trim() || raw.link?.trim() || "";
  return /^https:\/\//i.test(fallback) ? fallback : null;
}

function shoppingResultImage(raw: SerpShoppingRaw): string | null {
  const candidates = [
    raw.thumbnail,
    raw.thumbnails?.[0],
    raw.serpapi_thumbnail,
  ];
  let serpApiHosted: string | null = null;
  for (const candidate of candidates) {
    const url = usableRetailerProductImageUrl(candidate);
    if (!url) continue;
    if (/^https:\/\/(?:www\.)?serpapi\.com\//i.test(url)) {
      serpApiHosted ??= url;
      continue;
    }
    return url;
  }
  return serpApiHosted;
}

function parsePriceUsd(raw: SerpShoppingRaw): number | null {
  if (
    typeof raw.extracted_price === "number" &&
    Number.isFinite(raw.extracted_price) &&
    raw.extracted_price > 0
  ) {
    return raw.extracted_price;
  }
  const p = raw.price?.trim();
  if (!p) return null;
  const n = Number.parseFloat(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Google Shopping search via SerpApi (`engine=google_shopping`).
 * @see https://serpapi.com/google-shopping-api
 */
export async function searchGoogleShopping(
  query: string,
  opts?: { maxResults?: number },
): Promise<SerpShoppingResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  let data: { shopping_results?: SerpShoppingRaw[] };
  try {
    data = await serpApiGet<{ shopping_results?: SerpShoppingRaw[] }>({
      engine: "google_shopping",
      q,
      gl: "us",
      hl: "en",
      num: String(Math.min(opts?.maxResults ?? 12, 20)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Shopping search failed.";
    if (isSerpApiRateLimitError(msg) || isSerpApiTransientError(msg)) {
      throw err instanceof Error ? err : new Error(msg);
    }
    const http = /HTTP \d+/.exec(msg)?.[0];
    throw new Error(http ? `Shopping search failed (${http}).` : msg);
  }

  const rows = data.shopping_results ?? [];
  const out: SerpShoppingResult[] = [];

  for (const row of rows) {
    const title = row.title?.trim();
    const productUrl = shoppingResultUrl(row);
    const retailer = row.source?.trim() || "Retailer";
    if (!title || !productUrl) continue;

    out.push({
      title,
      retailer,
      productUrl,
      priceUsd: parsePriceUsd(row),
      imageUrl: shoppingResultImage(row),
      immersiveProductPageToken:
        row.immersive_product_page_token?.trim() || null,
    });
  }

  return out;
}

/** Google Shopping hits plus the first row that matches this retailer. */
export async function searchShoppingHitsForRetailer(opts: {
  query: string;
  retailerHostname?: string;
}): Promise<{ match: SerpShoppingResult | null; hits: SerpShoppingResult[] }> {
  const q = opts.query.trim();
  if (q.length < 2) return { match: null, hits: [] };

  const hits = await searchGoogleShopping(q, { maxResults: 15 });
  const hostNeedle = opts.retailerHostname
    ?.toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];

  const match = hostNeedle
    ? hits.find((h) => shoppingHitMatchesRetailer(h, hostNeedle)) ?? null
    : hits[0] ?? null;
  return { match, hits };
}

/** First Google Shopping hit for this retailer (title, price, image, URL). */
export async function findShoppingListingForRetailer(opts: {
  query: string;
  retailerHostname?: string;
}): Promise<SerpShoppingResult | null> {
  const { match } = await searchShoppingHitsForRetailer(opts);
  return match;
}

/** Align "Bath & Body Works" with bathandbodyworks.com (ampersand vs "and"). */
function normalizeRetailerToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function compactRetailerToken(value: string): string {
  return normalizeRetailerToken(value).replace(/and/g, "");
}

function tokensOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function compactTokensOverlap(a: string, b: string): boolean {
  const ca = compactRetailerToken(a);
  const cb = compactRetailerToken(b);
  return ca.length >= 8 && cb.length >= 8 && tokensOverlap(ca, cb);
}

function shoppingHitMatchesRetailer(
  hit: SerpShoppingResult,
  hostNeedle: string | undefined,
): boolean {
  if (!hostNeedle) return true;

  const needle = normalizeRetailerToken(hostNeedle);
  if (!needle) return false;

  const retailerToken = normalizeRetailerToken(hit.retailer);
  if (
    tokensOverlap(retailerToken, needle) ||
    compactTokensOverlap(hit.retailer, hostNeedle)
  ) {
    return true;
  }

  try {
    const urlHost = new URL(hit.productUrl).hostname.toLowerCase();
    if (urlHost.includes("google.")) return false;
    const urlStem = urlHost.replace(/^www\./, "").split(".")[0] ?? "";
    return (
      tokensOverlap(normalizeRetailerToken(urlStem), needle) ||
      compactTokensOverlap(urlStem, hostNeedle)
    );
  } catch {
    return false;
  }
}

/** Best shopping hit for a retailer hostname (for immersive variant follow-up). */
export async function findShoppingImmersiveToken(opts: {
  query: string;
  retailerHostname?: string;
}): Promise<{
  token: string | null;
  productUrl: string | null;
  retailer: string | null;
}> {
  const hits = await searchGoogleShopping(opts.query, { maxResults: 15 });
  const hostNeedle = opts.retailerHostname
    ?.toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];

  const match =
    hostNeedle ?
      hits.find(
        (h) =>
          shoppingHitMatchesRetailer(h, hostNeedle) &&
          h.immersiveProductPageToken,
      )
    : hits.find((h) => h.immersiveProductPageToken);

  if (!match?.immersiveProductPageToken) {
    return { token: null, productUrl: null, retailer: null };
  }

  return {
    token: match.immersiveProductPageToken,
    productUrl: match.productUrl,
    retailer: match.retailer,
  };
}
