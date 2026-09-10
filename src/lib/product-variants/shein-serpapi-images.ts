import { buildSheinSerpSearchQueries } from "@/lib/product-variants/shein-serp-search-query";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { mergeSheinVariantsWithPageImages } from "@/lib/product-variants/merge-shein-page-images";
import {
  parseSheinGoodsId,
  parseSheinListingTitleFromUrl,
  sheinHitMatchesDistinctiveTokens,
  sheinListingTitleOverlap,
} from "@/lib/product-variants/shein-goods-id";
import {
  fillMissingVariantImages,
  resolveListingImageUrl,
  usableRetailerProductImageUrl,
  variantRowsMissingProductImages,
} from "@/lib/product-variants/variant-images";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { searchGoogleImagesForSheinProduct } from "@/lib/serpapi/google-images";
import { fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import {
  findShoppingImmersiveToken,
  searchGoogleShopping,
  type SerpShoppingResult,
} from "@/lib/serpapi/google-shopping";

function sheinRowsMissingImages(rows: ProductVariantOffer[]): boolean {
  return variantRowsMissingProductImages(rows);
}

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

function pickSheinShoppingHit(
  hits: SerpShoppingResult[],
  productUrl: string,
  retailerHostname: string,
): SerpShoppingResult | null {
  const listingTitle = parseSheinListingTitleFromUrl(productUrl) ?? "";
  const goodsId = parseSheinGoodsId(productUrl);
  const sheinHits = hits.filter((h) => isSheinShoppingHit(h, retailerHostname));
  if (sheinHits.length === 0) return null;

  const byGoodsId =
    goodsId ?
      sheinHits.find(
        (h) =>
          (h.productUrl.includes(goodsId) || h.title.includes(goodsId)) &&
          usableRetailerProductImageUrl(h.imageUrl),
      )
    : null;
  if (byGoodsId) return byGoodsId;

  const scored = sheinHits
    .map((hit) => ({
      hit,
      score: listingTitle ? sheinListingTitleOverlap(listingTitle, hit.title) : 0,
      hasImage: Boolean(usableRetailerProductImageUrl(hit.imageUrl)),
    }))
    .sort((a, b) => {
      if (a.hasImage !== b.hasImage) return a.hasImage ? -1 : 1;
      return b.score - a.score;
    });

  const distinctive = listingTitle
    ? scored.filter(({ hit }) =>
        sheinHitMatchesDistinctiveTokens(listingTitle, hit.title),
      )
    : scored;

  const pool = distinctive.length > 0 ? distinctive : scored;
  const best = pool[0];
  if (!best) return null;
  if (listingTitle && best.score < 3 && distinctive.length === 0) return null;
  return best.hit;
}

function googleImagesQuery(productUrl: string, productName?: string | null): string {
  const slug = parseSheinListingTitleFromUrl(productUrl);
  const name = productName?.trim();
  const core = (slug && slug.length >= 12 ? slug : name || slug || "").trim();
  if (!core) return "";
  const clipped = core.split(/\s+/).slice(0, 10).join(" ");
  return `site:shein.com ${clipped}`;
}

/**
 * SerpApi image-only fallback for SHEIN page_ai rows (Google Shopping thumbnail +
 * Immersive option photos, then Google Images on shein.com). Does not change
 * variant prices from the live page scrape.
 */
export async function enrichSheinVariantsWithSerpApiImages(
  sheinRows: ProductVariantOffer[],
  opts: {
    productUrl: string;
    retailerHostname: string;
    productName?: string | null;
  },
): Promise<ProductVariantOffer[]> {
  if (!getSerpApiKey() || !sheinRowsMissingImages(sheinRows)) {
    return sheinRows;
  }

  const queries = buildSheinSerpSearchQueries({
    productUrl: opts.productUrl,
    productName: opts.productName,
    variants: sheinRows,
  }).slice(0, 2);
  let listingHero: string | null = null;

  for (const query of queries) {
    try {
      const hits = await searchGoogleShopping(query, { maxResults: 15 });
      const match = pickSheinShoppingHit(
        hits,
        opts.productUrl,
        opts.retailerHostname,
      );
      if (!match) continue;

      listingHero =
        usableRetailerProductImageUrl(match.imageUrl) ?? listingHero;

      if (match.immersiveProductPageToken) {
        const immersiveRows = await fetchImmersiveProductVariants(
          match.immersiveProductPageToken,
          {
            retailerHostname: opts.retailerHostname,
            fallbackProductUrl: match.productUrl ?? opts.productUrl,
          },
        );
        const merged = mergeSheinVariantsWithPageImages(sheinRows, immersiveRows);
        const filled = fillMissingVariantImages(
          merged,
          resolveListingImageUrl(merged, listingHero),
        );
        if (!sheinRowsMissingImages(filled)) return filled;
      }

      if (listingHero) {
        return fillMissingVariantImages(sheinRows, listingHero);
      }
    } catch {
      /* try next query / immersive token lookup */
    }
  }

  try {
    const tokenQuery = queries[0] ?? "SHEIN product";
    const { token, productUrl: hitUrl } = await findShoppingImmersiveToken({
      query: tokenQuery,
      retailerHostname: opts.retailerHostname,
    });
    if (token) {
      const immersiveRows = await fetchImmersiveProductVariants(token, {
        retailerHostname: opts.retailerHostname,
        fallbackProductUrl: hitUrl ?? opts.productUrl,
      });
      const merged = mergeSheinVariantsWithPageImages(sheinRows, immersiveRows);
      const filled = fillMissingVariantImages(
        merged,
        resolveListingImageUrl(merged, listingHero),
      );
      if (!sheinRowsMissingImages(filled)) return filled;
    }
  } catch {
    /* try Google Images */
  }

  try {
    const imageQuery = googleImagesQuery(opts.productUrl, opts.productName);
    const fromImages = imageQuery
      ? await searchGoogleImagesForSheinProduct(imageQuery)
      : null;
    listingHero = fromImages ?? listingHero;
  } catch {
    /* keep whatever shopping hero we have */
  }

  if (listingHero) {
    return fillMissingVariantImages(sheinRows, listingHero);
  }

  return sheinRows;
}
