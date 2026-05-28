import type { ProductVariantOffer } from "@/lib/product-variants/types";

import {
  colorKeyFromRow,
  colorsMatch,
  normalizeColorKey,
} from "@/lib/product-variants/merge-walmart-variants";

function pageRowForPrimaryRow(
  row: ProductVariantOffer,
  pageByColor: Map<string, ProductVariantOffer>,
): ProductVariantOffer | undefined {
  const key = colorKeyFromRow(row);
  if (key && pageByColor.has(key)) return pageByColor.get(key);

  for (const [pageKey, pageRow] of pageByColor) {
    if (colorsMatch(key, pageKey)) return pageRow;
    const pageLabel = normalizeColorKey(pageRow.label?.split("·")[0]);
    if (colorsMatch(key, pageLabel) || colorsMatch(pageKey, colorKeyFromRow(row))) {
      return pageRow;
    }
  }
  return undefined;
}

/**
 * Prefer live page scrape prices/URLs over SerpApi / Google Immersive when rows match by color/label.
 */
export function mergeVariantsPreferPageAi(
  primaryRows: ProductVariantOffer[],
  pageRows: ProductVariantOffer[],
): ProductVariantOffer[] {
  if (pageRows.length === 0) return primaryRows;
  if (primaryRows.length === 0) return pageRows;

  const pageByColor = new Map<string, ProductVariantOffer>();
  for (const row of pageRows) {
    const key = colorKeyFromRow(row);
    if (!key) continue;
    pageByColor.set(key, row);
  }

  const merged: ProductVariantOffer[] = primaryRows.map((row) => {
    const page = pageRowForPrimaryRow(row, pageByColor);
    if (!page) return row;

    const usePagePrice = page.priceUsdCents != null;
    const usePageImage = Boolean(page.imageUrl?.trim());

    if (!usePagePrice && !usePageImage) return row;

    return {
      ...row,
      priceUsdCents: usePagePrice ? page.priceUsdCents : row.priceUsdCents,
      productUrl: page.productUrl?.trim() || row.productUrl?.trim() || row.productUrl,
      imageUrl: page.imageUrl?.trim() || row.imageUrl?.trim() || row.imageUrl,
      inStock: page.inStock ?? row.inStock ?? row.inStock,
      label: row.label?.trim() || page.label?.trim() || row.label,
      size: row.size?.trim() || page.size?.trim() || row.size,
      color: row.color?.trim() || page.color?.trim() || row.color,
      source: usePagePrice || usePageImage ? "page_ai" : row.source,
    };
  });

  const seen = new Set(merged.map((r) => colorKeyFromRow(r)).filter(Boolean));
  for (const pageRow of pageRows) {
    const key = colorKeyFromRow(pageRow);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...pageRow,
      id: `page-extra-${merged.length}`,
      source: "page_ai",
    });
  }

  return merged;
}
