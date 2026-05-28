import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { priceUsdToCents } from "@/lib/product-variants/labels";
import { extractSheinMainSaleUsd } from "@/lib/product-variants/shein-from-page-html";
import {
  parseSheinGoodsId,
  parseSheinListingTitleFromUrl,
  sheinHitMatchesDistinctiveTokens,
  sheinListingTitleOverlap,
} from "@/lib/product-variants/shein-goods-id";
import {
  buildSheinSerpSearchQueries,
  buildSheinShortSerpSearchQuery,
} from "@/lib/product-variants/shein-serp-search-query";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { fetchImmersiveProductStoreOffers } from "@/lib/serpapi/google-immersive-product";
import {
  searchGoogleShopping,
  type SerpShoppingResult,
} from "@/lib/serpapi/google-shopping";

function isSheinShoppingHit(
  hit: { productUrl: string; retailer: string },
  retailerHostname: string,
): boolean {
  const needle = retailerHostname
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];
  if (hit.retailer.toLowerCase().includes("shein")) return true;
  try {
    const host = new URL(hit.productUrl).hostname.toLowerCase();
    return host.includes("shein") || (needle ? host.includes(needle) : false);
  } catch {
    return false;
  }
}

function hitMatchesGoodsId(hit: SerpShoppingResult, goodsId: string): boolean {
  const id = goodsId.trim();
  if (!id) return false;
  return hit.productUrl.includes(id) || hit.title.includes(id);
}

function dedupeShoppingHits(hits: SerpShoppingResult[]): SerpShoppingResult[] {
  const out: SerpShoppingResult[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = `${hit.title.toLowerCase()}|${hit.priceUsd ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function sortHitsByMatchQuality(
  listingTitle: string,
  hits: SerpShoppingResult[],
): SerpShoppingResult[] {
  return [...hits].sort((a, b) => {
    const overlapDiff =
      sheinListingTitleOverlap(listingTitle, b.title) -
      sheinListingTitleOverlap(listingTitle, a.title);
    if (overlapDiff !== 0) return overlapDiff;
    return (a.priceUsd ?? 999) - (b.priceUsd ?? 999);
  });
}

function pushPrice(candidates: number[], value: number | null | undefined): void {
  if (value != null && Number.isFinite(value) && value > 0) {
    candidates.push(value);
  }
}

function applySaleUsdToRows(
  rows: ProductVariantOffer[],
  saleUsd: number,
): ProductVariantOffer[] {
  const saleCents = priceUsdToCents(saleUsd);
  if (saleCents == null) return rows;

  return rows.map((row) => {
    const current = row.priceUsdCents;
    if (current != null && current <= saleCents) return row;
    return {
      ...row,
      priceUsdCents: saleCents,
      source: row.source ?? "page_ai",
    };
  });
}

async function collectSheinShoppingHits(
  queries: string[],
  retailerHostname: string,
): Promise<SerpShoppingResult[]> {
  const collected: SerpShoppingResult[] = [];
  for (const query of queries) {
    try {
      const hits = await searchGoogleShopping(query, { maxResults: 25 });
      collected.push(
        ...hits.filter((h) => isSheinShoppingHit(h, retailerHostname)),
      );
    } catch {
      /* try next query */
    }
  }
  return dedupeShoppingHits(collected);
}

async function collectImmersiveSheinPrices(
  hits: SerpShoppingResult[],
  listingTitle: string,
  goodsId: string | null,
): Promise<number[]> {
  const prices: number[] = [];

  for (const hit of hits) {
    if (!hit.immersiveProductPageToken) continue;
    try {
      const stores = await fetchImmersiveProductStoreOffers(
        hit.immersiveProductPageToken,
      );
      for (const store of stores) {
        if (!store.retailer.toLowerCase().includes("shein")) continue;
        if (goodsId && store.productUrl.includes(goodsId)) {
          pushPrice(prices, store.priceUsd);
          continue;
        }
        if (
          listingTitle &&
          (sheinListingTitleOverlap(listingTitle, store.title) >= 4 ||
            sheinHitMatchesDistinctiveTokens(listingTitle, store.title))
        ) {
          pushPrice(prices, store.priceUsd);
        }
      }
    } catch {
      /* try next hit */
    }
  }

  return prices;
}

async function resolveSheinSalePriceUsd(opts: {
  productUrl: string;
  retailerHostname: string;
  productName?: string | null;
  variants: ProductVariantOffer[];
}): Promise<number | null> {
  const goodsId = parseSheinGoodsId(opts.productUrl);
  const listingTitle =
    parseSheinListingTitleFromUrl(opts.productUrl) ??
    opts.productName?.trim() ??
    "";

  const queries = buildSheinSerpSearchQueries({
    productUrl: opts.productUrl,
    productName: opts.productName,
    variants: opts.variants,
  });
  const shortQuery = buildSheinShortSerpSearchQuery(opts.productUrl);
  if (shortQuery && !queries.includes(shortQuery)) {
    queries.push(shortQuery);
  }

  const sheinHits = await collectSheinShoppingHits(queries, opts.retailerHostname);
  if (sheinHits.length === 0) return null;

  const byGoodsId =
    goodsId ?
      sheinHits.find((h) => hitMatchesGoodsId(h, goodsId)) ?? null
    : null;

  const scored = sheinHits
    .map((hit) => ({
      hit,
      score: listingTitle ? sheinListingTitleOverlap(listingTitle, hit.title) : 0,
    }))
    .sort((a, b) => b.score - a.score);

  let distinctive =
    listingTitle ?
      scored.filter(({ hit }) =>
        sheinHitMatchesDistinctiveTokens(listingTitle, hit.title),
      )
    : scored;

  let poolHits = sortHitsByMatchQuality(
    listingTitle,
    distinctive.filter(({ score }) => score >= 4).map(({ hit }) => hit),
  );

  if (poolHits.length === 0) {
    distinctive =
      distinctive.length > 0 ? distinctive : scored;
    const topScore = distinctive[0]?.score ?? 0;
    if (topScore < 3) return null;
    poolHits = sortHitsByMatchQuality(
      listingTitle,
      distinctive.filter(({ score }) => score === topScore).map(({ hit }) => hit),
    );
  }

  if (byGoodsId && !poolHits.some((h) => h === byGoodsId)) {
    poolHits = sortHitsByMatchQuality(listingTitle, [byGoodsId, ...poolHits]);
  }

  const candidates: number[] = [];
  for (const hit of poolHits) {
    pushPrice(candidates, hit.priceUsd);
  }

  const immersivePrices = await collectImmersiveSheinPrices(
    poolHits.slice(0, 4),
    listingTitle,
    goodsId,
  );
  candidates.push(...immersivePrices);

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/** Prefer live page JSON or Google Shopping sale price over AI / retail estimates. */
export async function enrichSheinVariantsWithSerpApiPrices(
  sheinRows: ProductVariantOffer[],
  opts: {
    productUrl: string;
    retailerHostname: string;
    productName?: string | null;
    pageHtml?: string;
  },
): Promise<ProductVariantOffer[]> {
  if (sheinRows.length === 0) return sheinRows;

  const htmlSale =
    opts.pageHtml ? extractSheinMainSaleUsd(opts.pageHtml) : null;

  if (!getSerpApiKey()) {
    return htmlSale != null ? applySaleUsdToRows(sheinRows, htmlSale) : sheinRows;
  }

  const serpSale = await resolveSheinSalePriceUsd({
    productUrl: opts.productUrl,
    retailerHostname: opts.retailerHostname,
    productName: opts.productName,
    variants: sheinRows,
  });

  const bestSale =
    htmlSale != null && serpSale != null ? Math.min(htmlSale, serpSale)
    : htmlSale ?? serpSale;

  if (bestSale == null) return sheinRows;

  return applySaleUsdToRows(sheinRows, bestSale);
}
