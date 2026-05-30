import type { ProductVariantOffer } from "@/lib/product-variants/types";
import {
  buildVariantLabel,
  parseVariantKeys,
  priceUsdToCents,
} from "@/lib/product-variants/labels";
import { serpApiGet } from "@/lib/serpapi/http";

type WalmartPriceMap = {
  price?: number;
  currency?: string;
  was_price?: { price?: number };
};

type WalmartSwatchProduct = {
  product_id?: string;
  variants?: string[];
  in_stock?: boolean;
  price_map?: WalmartPriceMap;
};

type WalmartSwatchSelection = {
  id?: string;
  name?: string;
  swatch_image_url?: string;
  products?: WalmartSwatchProduct[];
};

type WalmartProductResult = {
  us_item_id?: string;
  product_id?: string;
  title?: string;
  product_page_url?: string;
  price_map?: WalmartPriceMap;
  in_stock?: boolean;
  images?: string[];
  variants?: string[];
  variant_swatches?: Array<{
    name?: string;
    available_selections?: WalmartSwatchSelection[];
  }>;
};

type WalmartProductResponse = {
  product_result?: WalmartProductResult;
};

const WALMART_PRODUCT_PARAMS = {
  engine: "walmart_product",
  device: "desktop",
} as const;

const MAX_ENRICH_LOOKUPS = 8;

function isColorDimension(name: string | undefined): boolean {
  const n = name?.toLowerCase() ?? "";
  return n.includes("color") || n.includes("colour");
}

function isSizeDimension(name: string | undefined): boolean {
  const n = name?.toLowerCase() ?? "";
  return n.includes("size") || n.includes("clothing_size");
}

/** Current sell price from SerpApi (not was_price). */
export function walmartPriceFromPriceMap(
  priceMap: WalmartPriceMap | undefined,
): number | null {
  return priceUsdToCents(priceMap?.price);
}

function walmartUrlFromIds(
  pageUrl: string | undefined,
  usItemId: string | undefined,
  productId: string | undefined,
): string | null {
  if (pageUrl?.trim() && /^https:\/\//i.test(pageUrl)) return pageUrl.trim();
  if (usItemId?.trim()) {
    return `https://www.walmart.com/ip/${usItemId.trim()}`;
  }
  if (productId?.trim()) {
    return `https://www.walmart.com/ip/${productId.trim()}`;
  }
  return null;
}

/** Listing URL before per-SKU enrichment (SerpApi alphanumeric ids are not Walmart /ip paths). */
function walmartVariantListingUrl(
  product: WalmartSwatchProduct,
  parent: Pick<WalmartProductResult, "product_page_url" | "us_item_id" | "product_id">,
): string | null {
  return walmartUrlFromIds(
    parent.product_page_url,
    parent.us_item_id,
    parent.product_id,
  );
}

function pickRepresentativeWalmartProduct(
  products: WalmartSwatchProduct[],
): WalmartSwatchProduct | null {
  if (products.length === 0) return null;
  if (products.length === 1) return products[0] ?? null;

  const scored = products.map((p) => ({
    p,
    cents: walmartPriceFromPriceMap(p.price_map),
    inStock: p.in_stock !== false,
  }));
  const pool = scored.some((s) => s.inStock) ?
    scored.filter((s) => s.inStock)
  : scored;

  pool.sort((a, b) => {
    if (a.cents == null && b.cents == null) return 0;
    if (a.cents == null) return 1;
    if (b.cents == null) return -1;
    return a.cents - b.cents;
  });

  return pool[0]?.p ?? products[0] ?? null;
}

function variantKeysIncludeCurrent(
  productVariants: string[] | undefined,
  currentKey: string,
): boolean {
  if (!currentKey) return false;
  const key = (productVariants ?? []).join("|");
  return key.length > 0 && key === currentKey;
}

function walmartRowNeedsEnrichment(row: ProductVariantOffer): boolean {
  return row.priceUsdCents == null || !row.productUrl?.trim();
}

async function enrichWalmartVariantRows(
  rows: ProductVariantOffer[],
): Promise<ProductVariantOffer[]> {
  const ids = [
    ...new Set(
      rows
        .filter(
          (r) =>
            r.retailerProductId?.trim() && walmartRowNeedsEnrichment(r),
        )
        .map((r) => r.retailerProductId!.trim()),
    ),
  ].slice(0, MAX_ENRICH_LOOKUPS);

  if (ids.length === 0) return rows;

  const summaries = await Promise.all(
    ids.map(async (id) => {
      try {
        return { id, summary: await fetchWalmartProductSummary(id) };
      } catch {
        return { id, summary: null };
      }
    }),
  );

  const byId = new Map(summaries.map((s) => [s.id, s.summary]));

  return rows.map((row) => {
    const id = row.retailerProductId?.trim();
    if (!id) return row;
    const summary = byId.get(id);
    if (!summary) return row;
    // Swatch `price_map` on the parent listing is often more current than a per-SKU
    // lookup (e.g. Floral $14.88 on listing vs $15.62 on alphanumeric product_id).
    return {
      ...row,
      priceUsdCents: row.priceUsdCents ?? summary.priceUsdCents,
      productUrl: summary.productUrl ?? row.productUrl,
      imageUrl: summary.imageUrl ?? row.imageUrl,
    };
  });
}

/** Title, price, and hero image for a Walmart product id (one SerpApi call). */
export async function fetchWalmartProductSummary(productId: string): Promise<{
  title: string | null;
  priceUsdCents: number | null;
  imageUrl: string | null;
  productUrl: string | null;
}> {
  const data = await serpApiGet<WalmartProductResponse>({
    ...WALMART_PRODUCT_PARAMS,
    product_id: productId,
  });
  const pr = data.product_result;
  if (!pr) {
    return { title: null, priceUsdCents: null, imageUrl: null, productUrl: null };
  }
  return {
    title: pr.title?.trim() || null,
    priceUsdCents: walmartPriceFromPriceMap(pr.price_map),
    imageUrl: pr.images?.[0]?.trim() || null,
    productUrl: walmartUrlFromIds(
      pr.product_page_url,
      pr.us_item_id,
      pr.product_id,
    ),
  };
}

export type WalmartVariantsResult = {
  variants: ProductVariantOffer[];
  listingTitle: string | null;
  listingImageUrl: string | null;
};

/**
 * SKU rows from Walmart `variant_swatches`, with per-SKU SerpApi price refresh
 * only when swatch rows are missing price or URL.
 */
export async function fetchWalmartVariants(
  productId: string,
  opts?: { currentVariantKeys?: string[] },
): Promise<WalmartVariantsResult> {
  const data = await serpApiGet<WalmartProductResponse>({
    ...WALMART_PRODUCT_PARAMS,
    product_id: productId,
  });

  const pr = data.product_result;
  if (!pr) {
    return { variants: [], listingTitle: null, listingImageUrl: null };
  }

  const listingTitle = pr.title?.trim() || null;

  const baseUrl = walmartUrlFromIds(
    pr.product_page_url,
    pr.us_item_id,
    pr.product_id,
  );
  const heroImage = pr.images?.[0]?.trim() || null;
  const currentKey = (opts?.currentVariantKeys ?? pr.variants ?? []).join("|");

  const rows: ProductVariantOffer[] = [];
  const seen = new Set<string>();

  const pushRow = (row: Omit<ProductVariantOffer, "id">, dedupeKey: string) => {
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push({
      ...row,
      id: `walmart-${rows.length}`,
      source: "walmart",
    });
  };

  const swatches = pr.variant_swatches ?? [];
  const onlyColorSwatch =
    swatches.length === 1 && isColorDimension(swatches[0]?.name);

  for (const swatch of swatches) {
    const dimension = swatch.name?.trim();
    const colorDim = isColorDimension(dimension);
    const sizeDim = isSizeDimension(dimension);

    for (const selection of swatch.available_selections ?? []) {
      const selectionName = selection.name?.trim();
      const selectionImage = selection.swatch_image_url?.trim() || heroImage;
      const products = selection.products ?? [];

      const productsToEmit =
        onlyColorSwatch && colorDim ?
          (() => {
            const pick = pickRepresentativeWalmartProduct(products);
            return pick ? [pick] : [];
          })()
        : products;

      for (const product of productsToEmit) {
        const parsed = parseVariantKeys(product.variants);
        if (selectionName && !parsed.color && colorDim) {
          parsed.color = selectionName;
        }
        if (selectionName && !parsed.size && sizeDim) {
          parsed.size = selectionName;
        }
        if (
          selectionName &&
          !parsed.packLabel &&
          (dimension?.toLowerCase().includes("pack") ||
            dimension?.toLowerCase().includes("count"))
        ) {
          parsed.packLabel = selectionName;
        }

        const variantKey = (product.variants ?? []).join("|");
        const retailerProductId = product.product_id?.trim() || null;

        pushRow(
          {
            label: buildVariantLabel({
              color: parsed.color,
              size: parsed.size,
              packLabel:
                colorDim ? null : (
                  parsed.packLabel ??
                  (dimension && selectionName ?
                    `${dimension}: ${selectionName}`
                  : null)
                ),
            }),
            size: parsed.size,
            color: parsed.color,
            packLabel: parsed.packLabel,
            priceUsdCents: walmartPriceFromPriceMap(product.price_map),
            productUrl: walmartVariantListingUrl(product, pr),
            imageUrl: selectionImage,
            inStock: product.in_stock ?? null,
            isCurrent: variantKeysIncludeCurrent(product.variants, currentKey),
            source: "walmart",
            retailerProductId,
          },
          onlyColorSwatch && colorDim ?
            `color:${selection.id ?? selectionName ?? variantKey}`
          : `${variantKey}|${retailerProductId ?? selectionName}`,
        );
      }
    }
  }

  if (rows.length === 0) {
    const parsed = parseVariantKeys(pr.variants);
    const fallbackLabel =
      pr.title?.trim() || buildVariantLabel(parsed);
    pushRow(
      {
        label: fallbackLabel,
        size: parsed.size,
        color: parsed.color,
        packLabel: parsed.packLabel,
        priceUsdCents: walmartPriceFromPriceMap(pr.price_map),
        productUrl: baseUrl,
        imageUrl: heroImage,
        inStock: pr.in_stock ?? null,
        isCurrent: true,
        source: "walmart",
        retailerProductId: pr.product_id?.trim() ?? pr.us_item_id?.trim() ?? null,
        productTitle: pr.title?.trim() || null,
      },
      "fallback",
    );
  }

  const variants = await enrichWalmartVariantRows(rows);
  return { variants, listingTitle, listingImageUrl: heroImage };
}
