import type { ProductVariantOffer } from "@/lib/product-variants/types";

export function normalizeColorKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function colorKeyFromRow(row: ProductVariantOffer): string {
  const color = normalizeColorKey(row.color);
  if (color) return color;
  const label = normalizeColorKey(row.label?.split("·")[0]);
  if (label) return label;
  return "";
}

function colorsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function pageRowForSerpRow(
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

/** Best variant row for a requested color (exact, then partial label/color match). */
export function findVariantMatchingColor(
  variants: ProductVariantOffer[],
  colorRaw: string,
): ProductVariantOffer | undefined {
  const colorNorm = normalizeColorKey(colorRaw);
  if (!colorNorm) return undefined;

  const exact = variants.find((v) => normalizeColorKey(v.color) === colorNorm);
  if (exact) return exact;

  return variants.find((v) => {
    const vc = normalizeColorKey(v.color);
    const label = normalizeColorKey(v.label?.split("·")[0]);
    return (
      colorsMatch(vc, colorNorm) ||
      colorsMatch(label, colorNorm) ||
      label.includes(colorNorm) ||
      colorNorm.includes(label)
    );
  });
}

/** Prefer live page scrape prices/URLs over SerpApi swatch data when colors match. */
export function mergeWalmartVariantsWithPageAi(
  serpRows: ProductVariantOffer[],
  pageRows: ProductVariantOffer[],
): ProductVariantOffer[] {
  if (pageRows.length === 0) return serpRows;

  const pageByColor = new Map<string, ProductVariantOffer>();
  for (const row of pageRows) {
    const key = colorKeyFromRow(row);
    if (!key) continue;
    pageByColor.set(key, row);
  }

  const merged: ProductVariantOffer[] = serpRows.map((row) => {
    const page = pageRowForSerpRow(row, pageByColor);
    if (!page) return row;

    const usePagePrice =
      page.priceUsdCents != null && row.priceUsdCents == null;

    return {
      ...row,
      priceUsdCents: usePagePrice ? page.priceUsdCents : row.priceUsdCents,
      productUrl: row.productUrl?.trim() || page.productUrl?.trim() || row.productUrl,
      imageUrl: row.imageUrl?.trim() || page.imageUrl?.trim() || row.imageUrl,
      inStock: row.inStock ?? page.inStock ?? row.inStock,
      label: row.label?.trim() || page.label?.trim() || row.label,
      source: usePagePrice ? "page_ai" : row.source,
    };
  });

  const seen = new Set(merged.map((r) => colorKeyFromRow(r)).filter(Boolean));
  for (const pageRow of pageRows) {
    const key = colorKeyFromRow(pageRow);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...pageRow,
      id: `walmart-page-${merged.length}`,
      source: "page_ai",
    });
  }

  return merged;
}
