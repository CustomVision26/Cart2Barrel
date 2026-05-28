import { buildSheinSerpSearchQuery } from "@/lib/product-variants/shein-serp-search-query";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { mergeSheinVariantsWithPageImages } from "@/lib/product-variants/merge-shein-page-images";
import {
  fillMissingVariantImages,
  normalizeRetailerImageUrl,
  resolveListingImageUrl,
} from "@/lib/product-variants/variant-images";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import {
  findShoppingImmersiveToken,
  searchGoogleShopping,
} from "@/lib/serpapi/google-shopping";

function sheinRowsMissingImages(rows: ProductVariantOffer[]): boolean {
  return !rows.some((r) => normalizeRetailerImageUrl(r.imageUrl));
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

/**
 * SerpApi image-only fallback for SHEIN page_ai rows (Google Shopping thumbnail +
 * Immersive option photos). Does not change variant prices from the live page scrape.
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

  const query = buildSheinSerpSearchQuery({
    productUrl: opts.productUrl,
    productName: opts.productName,
    variants: sheinRows,
  });
  let listingHero: string | null = null;

  try {
    const hits = await searchGoogleShopping(query, { maxResults: 15 });
    const match =
      hits.find((h) => isSheinShoppingHit(h, opts.retailerHostname)) ?? null;

    listingHero = normalizeRetailerImageUrl(match?.imageUrl);

    if (match?.immersiveProductPageToken) {
      const immersiveRows = await fetchImmersiveProductVariants(
        match.immersiveProductPageToken,
        {
          retailerHostname: opts.retailerHostname,
          fallbackProductUrl: match.productUrl ?? opts.productUrl,
        },
      );
      const merged = mergeSheinVariantsWithPageImages(sheinRows, immersiveRows);
      return fillMissingVariantImages(
        merged,
        resolveListingImageUrl(merged, listingHero),
      );
    }
  } catch {
    /* try immersive token lookup below */
  }

  try {
    const { token, productUrl: hitUrl } = await findShoppingImmersiveToken({
      query,
      retailerHostname: opts.retailerHostname,
    });
    if (token) {
      const immersiveRows = await fetchImmersiveProductVariants(token, {
        retailerHostname: opts.retailerHostname,
        fallbackProductUrl: hitUrl ?? opts.productUrl,
      });
      const merged = mergeSheinVariantsWithPageImages(sheinRows, immersiveRows);
      return fillMissingVariantImages(
        merged,
        resolveListingImageUrl(merged, listingHero),
      );
    }
  } catch {
    /* keep page prices without images */
  }

  if (listingHero) {
    return fillMissingVariantImages(sheinRows, listingHero);
  }

  return sheinRows;
}
