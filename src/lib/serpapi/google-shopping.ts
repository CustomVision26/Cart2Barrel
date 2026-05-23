import { getSerpApiKey } from "@/lib/serpapi/env";

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
  serpapi_thumbnail?: string;
  immersive_product_page_token?: string;
};

function shoppingResultUrl(raw: SerpShoppingRaw): string | null {
  const direct = raw.link?.trim();
  if (direct && /^https:\/\//i.test(direct)) return direct;
  const productLink = raw.product_link?.trim();
  if (productLink && /^https:\/\//i.test(productLink)) return productLink;
  return null;
}

function shoppingResultImage(raw: SerpShoppingRaw): string | null {
  return raw.thumbnail?.trim() || raw.serpapi_thumbnail?.trim() || null;
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
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not configured.");
  }

  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", q);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", String(Math.min(opts?.maxResults ?? 12, 20)));

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Shopping search failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    shopping_results?: SerpShoppingRaw[];
    error?: string;
  };

  if (data.error) {
    throw new Error(data.error);
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
      hits.find((h) => {
        try {
          const hHost = new URL(h.productUrl).hostname.toLowerCase();
          return (
            hHost.includes(hostNeedle) ||
            h.retailer.toLowerCase().includes(hostNeedle)
          );
        } catch {
          return h.retailer.toLowerCase().includes(hostNeedle);
        }
      })
    : hits[0];

  if (!match?.immersiveProductPageToken) {
    return { token: null, productUrl: null, retailer: null };
  }

  return {
    token: match.immersiveProductPageToken,
    productUrl: match.productUrl,
    retailer: match.retailer,
  };
}
