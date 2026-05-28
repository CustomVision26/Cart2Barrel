import { buildVariantLabel, priceUsdToCents } from "@/lib/product-variants/labels";
import type { ProductVariantOffer } from "@/lib/product-variants/types";

function parseUsdAmount(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Main listing sale price from SHEIN embedded JSON (not crossed-out retail). */
export function extractSheinMainSaleUsd(html: string): number | null {
  const patterns = [
    /"salePrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/,
    /"salePrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/,
    /"discountPrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/,
    /"discountPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const usd = parseUsdAmount(m?.[1]);
    if (usd != null) return usd;
  }
  return null;
}

type SheinSkuChunk = {
  color: string | null;
  size: string | null;
  saleUsd: number;
};

/** SKU rows from SHEIN `sku_list` / similar blobs in page HTML. */
function extractSheinSkuChunks(html: string): SheinSkuChunk[] {
  const chunks: SheinSkuChunk[] = [];
  const blockRe =
    /\{[^{}]{0,1200}?"sku_code"\s*:\s*"[^"]+"[^{}]{0,1200}?"salePrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"[^{}]{0,1200}?\}/g;

  for (const block of html.matchAll(blockRe)) {
    const segment = block[0];
    const saleUsd = parseUsdAmount(block[1]);
    if (saleUsd == null) continue;

    const color =
      segment.match(/"attr_value_name_en"\s*:\s*"([^"]+)"/i)?.[1]?.trim() ||
      segment.match(/"attr_value"\s*:\s*"([^"]+)"/i)?.[1]?.trim() ||
      segment.match(/"color_name"\s*:\s*"([^"]+)"/i)?.[1]?.trim() ||
      null;

    const size =
      segment.match(/"attr_value_name_en"\s*:\s*"([^"]+)"/gi)?.[1]?.trim() ||
      segment.match(/"size_name"\s*:\s*"([^"]+)"/i)?.[1]?.trim() ||
      null;

    chunks.push({ color, size, saleUsd });
  }

  return chunks;
}

/**
 * Build variant rows from SHEIN page HTML when embedded JSON is present.
 * Returns [] when the page structure is unrecognized (caller falls back to OpenAI).
 */
export function extractSheinVariantsFromHtml(
  html: string,
  pageUrl: string,
): ProductVariantOffer[] {
  const skuChunks = extractSheinSkuChunks(html);
  const mainSale = extractSheinMainSaleUsd(html);

  const rows: ProductVariantOffer[] = [];
  const seen = new Set<string>();

  const push = (row: Omit<ProductVariantOffer, "id" | "source">) => {
    const key = `${row.label}|${row.priceUsdCents}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      ...row,
      id: `shein-${rows.length}`,
      source: "page_ai",
    });
  };

  for (const chunk of skuChunks) {
    const label = buildVariantLabel({
      color: chunk.color,
      size: chunk.size,
      packLabel: null,
    });
    push({
      label,
      size: chunk.size,
      color: chunk.color,
      packLabel: null,
      priceUsdCents: priceUsdToCents(chunk.saleUsd),
      productUrl: pageUrl,
      imageUrl: null,
      inStock: true,
      isCurrent: false,
    });
  }

  if (rows.length === 0 && mainSale != null) {
    push({
      label: "Current listing",
      size: null,
      color: null,
      packLabel: null,
      priceUsdCents: priceUsdToCents(mainSale),
      productUrl: pageUrl,
      imageUrl: null,
      inStock: true,
      isCurrent: true,
    });
  } else if (rows.length > 0 && mainSale != null) {
    const hasCurrent = rows.some((r) => r.isCurrent);
    if (!hasCurrent) {
      const closest = rows.find((r) => r.priceUsdCents === priceUsdToCents(mainSale)) ?? rows[0];
      if (closest) closest.isCurrent = true;
    }
  }

  return rows.slice(0, 32);
}
