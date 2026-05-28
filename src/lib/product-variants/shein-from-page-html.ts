import { buildVariantLabel, priceUsdToCents } from "@/lib/product-variants/labels";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { normalizeRetailerImageUrl } from "@/lib/product-variants/variant-images";

function parseUsdAmount(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeColorKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function coerceSheinCdnMatch(raw: string): string | null {
  let s = raw.replace(/\\/g, "");
  if (s.startsWith("//")) s = `https:${s}`;
  else if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  return normalizeRetailerImageUrl(s);
}

/** SHEIN product photos from page HTML / embedded JSON. */
export function extractSheinCdnImageUrls(html: string): string[] {
  const re =
    /(?:https?:)?(?:\\\/\/|\/\/)?img\.ltwebstatic\.com\/[a-zA-Z0-9_./%-]+/gi;
  const out: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(re)) {
    const url = coerceSheinCdnMatch(match[0]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

/** Map color name → image URL from swatch / SKU blobs. */
function extractSheinColorImageMap(html: string): Map<string, string> {
  const map = new Map<string, string>();

  const pairedRe =
    /"attr_value_name_en"\s*:\s*"([^"]+)"[\s\S]{0,2500}?(?:"goods_img"|"sku_image"|"origin_image"|"color_image"|"goods_thumb")\s*:\s*"(https?:\/\/[^"]+)"/gi;

  for (const match of html.matchAll(pairedRe)) {
    const color = normalizeColorKey(match[1]);
    const url = normalizeRetailerImageUrl(match[2]);
    if (!color || !url) continue;
    if (!map.has(color)) map.set(color, url);
  }

  const altRe =
    /"(?:goods_img|sku_image|origin_image|color_image)"\s*:\s*"(https?:\/\/[^"]+)"[\s\S]{0,2500}?"attr_value_name_en"\s*:\s*"([^"]+)"/gi;

  for (const match of html.matchAll(altRe)) {
    const url = normalizeRetailerImageUrl(match[1]);
    const color = normalizeColorKey(match[2]);
    if (!color || !url) continue;
    if (!map.has(color)) map.set(color, url);
  }

  return map;
}

function imageForSheinColor(
  color: string | null,
  colorMap: Map<string, string>,
  heroImage: string | null,
  cdnUrls: string[],
): string | null {
  const key = normalizeColorKey(color);
  if (key && colorMap.has(key)) return colorMap.get(key) ?? null;

  if (key) {
    for (const [name, url] of colorMap) {
      if (key.includes(name) || name.includes(key)) return url;
    }
    const fromPath = cdnUrls.find((u) => {
      const slug = key.replace(/\s+/g, "");
      return slug.length >= 3 && u.toLowerCase().includes(slug);
    });
    if (fromPath) return fromPath;
  }

  return heroImage;
}

/** Main listing sale price from SHEIN embedded JSON (not crossed-out retail). */
export function extractSheinMainSaleUsd(html: string): number | null {
  const salePatterns = [
    /"salePrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/g,
    /"salePrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/g,
    /"discountPrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/g,
    /"discountPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/g,
  ];

  const candidates: number[] = [];
  for (const re of salePatterns) {
    for (const match of html.matchAll(re)) {
      const usd = parseUsdAmount(match[1]);
      if (usd != null) candidates.push(usd);
    }
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function extractSaleUsdFromSkuSegment(segment: string): number | null {
  const salePatterns = [
    /"salePrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/,
    /"salePrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/,
    /"discountPrice"\s*:\s*\{[^}]*"usdAmount"\s*:\s*"([0-9.]+)"/,
    /"discountPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"([0-9.]+)"/,
  ];
  for (const re of salePatterns) {
    const m = segment.match(re);
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
    /\{[^{}]{0,1600}?"sku_code"\s*:\s*"[^"]+"[^{}]{0,1600}?\}/g;

  for (const block of html.matchAll(blockRe)) {
    const segment = block[0];
    if (!/"salePrice"|"discountPrice"/.test(segment)) continue;

    const saleUsd = extractSaleUsdFromSkuSegment(segment);
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
  const cdnUrls = extractSheinCdnImageUrls(html);
  const colorImages = extractSheinColorImageMap(html);
  const heroImage = cdnUrls[0] ?? null;

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
      imageUrl: imageForSheinColor(chunk.color, colorImages, heroImage, cdnUrls),
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
      imageUrl: heroImage,
      inStock: true,
      isCurrent: true,
    });
  } else if (rows.length > 0 && mainSale != null) {
    const hasCurrent = rows.some((r) => r.isCurrent);
    if (!hasCurrent) {
      const closest =
        rows.find((r) => r.priceUsdCents === priceUsdToCents(mainSale)) ?? rows[0];
      if (closest) closest.isCurrent = true;
    }
  }

  return rows.slice(0, 32);
}
