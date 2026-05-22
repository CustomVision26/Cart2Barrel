import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { buildVariantLabel, priceUsdToCents } from "@/lib/product-variants/labels";
import {
  amazonProductUrl,
  type ParsedProductUrl,
} from "@/lib/product-url/retailer-id";
import { serpApiGet } from "@/lib/serpapi/http";

/** Cap SerpApi calls during admin spotlight import (full matrix still available in item request flow). */
const MAX_ASIN_FETCHES = 12;
const ASIN_CONCURRENCY = 6;

type AmazonVariantItem = {
  asin?: string;
  name?: string;
  selected?: boolean;
};

type AmazonVariantGroup = {
  title?: string;
  items?: AmazonVariantItem[];
};

type AmazonProductResponse = {
  product_results?: {
    asin?: string;
    title?: string;
    price?: string;
    extracted_price?: number;
    thumbnail?: string;
    link?: string;
    variants?: AmazonVariantGroup[];
  };
};

function parseAmazonPrice(raw: {
  price?: string;
  extracted_price?: number;
}): number | null {
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

/** Title, price, and image for one Amazon ASIN (one SerpApi call). */
export async function fetchAmazonProductSummary(
  asin: string,
  amazonDomain: string,
): Promise<{
  title: string | null;
  priceUsdCents: number | null;
  imageUrl: string | null;
  productUrl: string | null;
}> {
  const hit = await fetchAmazonAsinPrice(asin, amazonDomain);
  return {
    title: hit.title,
    priceUsdCents:
      hit.priceUsd != null ? Math.round(hit.priceUsd * 100) : null,
    imageUrl: hit.imageUrl,
    productUrl: hit.link,
  };
}

async function fetchAmazonAsinPrice(
  asin: string,
  amazonDomain: string,
): Promise<{
  priceUsd: number | null;
  title: string | null;
  imageUrl: string | null;
  link: string | null;
}> {
  const data = await serpApiGet<AmazonProductResponse>({
    engine: "amazon_product",
    asin,
    amazon_domain: amazonDomain,
  });
  const pr = data.product_results;
  return {
    priceUsd: parseAmazonPrice(pr ?? {}),
    title: pr?.title?.trim() || null,
    imageUrl: pr?.thumbnail?.trim() || null,
    link: pr?.link?.trim() || amazonProductUrl(asin, amazonDomain),
  };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

function collectAmazonAsinRows(
  groups: AmazonVariantGroup[] | undefined,
  primaryAsin: string,
): Array<{ asin: string; name: string; groupTitle: string; selected: boolean }> {
  const rows: Array<{
    asin: string;
    name: string;
    groupTitle: string;
    selected: boolean;
  }> = [];
  const seen = new Set<string>();

  for (const group of groups ?? []) {
    const groupTitle = group.title?.trim() || "Option";
    for (const item of group.items ?? []) {
      const asin = item.asin?.trim().toUpperCase();
      const name = item.name?.trim();
      if (!asin || !name || seen.has(asin)) continue;
      seen.add(asin);
      rows.push({
        asin,
        name,
        groupTitle,
        selected: Boolean(item.selected) || asin === primaryAsin,
      });
    }
  }

  if (rows.length === 0 && primaryAsin) {
    rows.push({
      asin: primaryAsin,
      name: "Current listing",
      groupTitle: "Listing",
      selected: true,
    });
  }

  return rows.slice(0, MAX_ASIN_FETCHES);
}

/**
 * Amazon variant matrix: dedupe ASINs from variant groups, fetch price per ASIN (capped).
 */
export async function fetchAmazonVariants(
  parsed: ParsedProductUrl,
  asin: string,
): Promise<ProductVariantOffer[]> {
  const domain = parsed.amazonDomain;
  const primary = await serpApiGet<AmazonProductResponse>({
    engine: "amazon_product",
    asin,
    amazon_domain: domain,
  });

  const pr = primary.product_results;
  const asinRows = collectAmazonAsinRows(pr?.variants, asin);

  const priceByAsin = new Map<
    string,
    { priceUsd: number | null; imageUrl: string | null; link: string | null }
  >();

  const priced = await mapPool(asinRows, ASIN_CONCURRENCY, async (row) => {
    if (row.asin === asin && pr) {
      return {
        asin: row.asin,
        priceUsd: parseAmazonPrice(pr),
        imageUrl: pr.thumbnail?.trim() || null,
        link: pr.link?.trim() || amazonProductUrl(row.asin, domain),
      };
    }
    const detail = await fetchAmazonAsinPrice(row.asin, domain);
    return { asin: row.asin, ...detail };
  });

  for (const p of priced) {
    priceByAsin.set(p.asin, {
      priceUsd: p.priceUsd,
      imageUrl: p.imageUrl,
      link: p.link,
    });
  }

  const byAsin = new Map<string, ProductVariantOffer>();

  for (const row of asinRows) {
    const existing = byAsin.get(row.asin);
    const price = priceByAsin.get(row.asin);
    const url = price?.link ?? amazonProductUrl(row.asin, domain);

    const packLabel =
      row.groupTitle.toLowerCase().includes("size") ||
      row.groupTitle.toLowerCase().includes("pack") ||
      row.groupTitle.toLowerCase().includes("count")
        ? row.name
        : null;
    const color =
      row.groupTitle.toLowerCase().includes("color") ||
      row.groupTitle.toLowerCase().includes("flavor")
        ? row.name
        : null;
    const size =
      row.groupTitle.toLowerCase().includes("size") && !packLabel ? row.name : null;

    if (existing) {
      if (color) existing.color = color;
      if (size) existing.size = size;
      if (packLabel) existing.packLabel = packLabel;
      existing.label = buildVariantLabel(existing);
      if (row.selected) existing.isCurrent = true;
      continue;
    }

    byAsin.set(row.asin, {
      id: `amazon-${row.asin}`,
      label: buildVariantLabel({
        color,
        size,
        packLabel: packLabel ?? (!color && !size ? row.name : null),
      }),
      size,
      color,
      packLabel,
      priceUsdCents: priceUsdToCents(price?.priceUsd),
      productUrl: url,
      imageUrl: price?.imageUrl ?? pr?.thumbnail?.trim() ?? null,
      inStock: null,
      isCurrent: row.selected,
      source: "amazon",
    });
  }

  return [...byAsin.values()];
}
