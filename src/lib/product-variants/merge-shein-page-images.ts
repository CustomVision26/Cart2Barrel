import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { normalizeColorKey } from "@/lib/product-variants/merge-walmart-variants";
import { normalizeRetailerImageUrl } from "@/lib/product-variants/variant-images";

function pageRowForSheinRow(
  row: ProductVariantOffer,
  pageByColor: Map<string, ProductVariantOffer>,
): ProductVariantOffer | undefined {
  const key = normalizeColorKey(row.color) || normalizeColorKey(row.label?.split("·")[0]);
  if (key && pageByColor.has(key)) return pageByColor.get(key);

  for (const [pageKey, pageRow] of pageByColor) {
    if (key && (key.includes(pageKey) || pageKey.includes(key))) return pageRow;
  }
  return undefined;
}

/** Attach OpenAI-scraped image URLs to SHEIN JSON variant rows when CDN parse missed photos. */
export function mergeSheinVariantsWithPageImages(
  sheinRows: ProductVariantOffer[],
  pageRows: ProductVariantOffer[],
): ProductVariantOffer[] {
  if (pageRows.length === 0) return sheinRows;

  const pageByColor = new Map<string, ProductVariantOffer>();
  for (const row of pageRows) {
    const key = normalizeColorKey(row.color) || normalizeColorKey(row.label?.split("·")[0]);
    if (!key) continue;
    pageByColor.set(key, row);
  }

  const pageHero = normalizeRetailerImageUrl(
    pageRows.find((r) => normalizeRetailerImageUrl(r.imageUrl))?.imageUrl,
  );

  return sheinRows.map((row) => {
    const existing = normalizeRetailerImageUrl(row.imageUrl);
    if (existing) return { ...row, imageUrl: existing };

    const page = pageRowForSheinRow(row, pageByColor);
    const fromPage = normalizeRetailerImageUrl(page?.imageUrl);
    return {
      ...row,
      imageUrl: fromPage ?? pageHero,
    };
  });
}
