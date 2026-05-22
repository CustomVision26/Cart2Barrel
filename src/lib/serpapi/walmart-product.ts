import type { ProductVariantOffer } from "@/lib/product-variants/types";
import {
  buildVariantLabel,
  parseVariantKeys,
  priceUsdToCents,
} from "@/lib/product-variants/labels";
import { serpApiGet } from "@/lib/serpapi/http";

type WalmartSwatchProduct = {
  product_id?: string;
  variants?: string[];
  in_stock?: boolean;
  price_map?: { price?: number; currency?: string };
};

type WalmartSwatchSelection = {
  id?: string;
  name?: string;
  products?: WalmartSwatchProduct[];
};

type WalmartProductResponse = {
  product_result?: {
    us_item_id?: string;
    product_id?: string;
    title?: string;
    product_page_url?: string;
    price_map?: { price?: number };
    in_stock?: boolean;
    images?: string[];
    variants?: string[];
    variant_swatches?: Array<{
      name?: string;
      available_selections?: WalmartSwatchSelection[];
    }>;
  };
};

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

/** Title, price, and hero image for a Walmart product id (one SerpApi call). */
export async function fetchWalmartProductSummary(productId: string): Promise<{
  title: string | null;
  priceUsdCents: number | null;
  imageUrl: string | null;
  productUrl: string | null;
}> {
  const data = await serpApiGet<WalmartProductResponse>({
    engine: "walmart_product",
    product_id: productId,
  });
  const pr = data.product_result;
  if (!pr) {
    return { title: null, priceUsdCents: null, imageUrl: null, productUrl: null };
  }
  return {
    title: pr.title?.trim() || null,
    priceUsdCents: priceUsdToCents(pr.price_map?.price),
    imageUrl: pr.images?.[0]?.trim() || null,
    productUrl: walmartUrlFromIds(
      pr.product_page_url,
      pr.us_item_id,
      pr.product_id,
    ),
  };
}

/**
 * All SKU rows from Walmart `variant_swatches` (one SerpApi call).
 */
export async function fetchWalmartVariants(
  productId: string,
  opts?: { currentVariantKeys?: string[] },
): Promise<ProductVariantOffer[]> {
  const data = await serpApiGet<WalmartProductResponse>({
    engine: "walmart_product",
    product_id: productId,
  });

  const pr = data.product_result;
  if (!pr) return [];

  const baseUrl = walmartUrlFromIds(
    pr.product_page_url,
    pr.us_item_id,
    pr.product_id,
  );
  const heroImage = pr.images?.[0]?.trim() || null;
  const currentKey = (opts?.currentVariantKeys ?? pr.variants ?? []).join("|");

  const rows: ProductVariantOffer[] = [];
  const seen = new Set<string>();

  const pushRow = (row: Omit<ProductVariantOffer, "id">) => {
    const dedupe = `${row.label}|${row.priceUsdCents}|${row.productUrl}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    rows.push({
      ...row,
      id: `walmart-${rows.length}`,
      source: "walmart",
    });
  };

  const swatches = pr.variant_swatches ?? [];
  for (const swatch of swatches) {
    const dimension = swatch.name?.trim();
    for (const selection of swatch.available_selections ?? []) {
      const selectionName = selection.name?.trim();
      for (const product of selection.products ?? []) {
        const parsed = parseVariantKeys(product.variants);
        if (selectionName && !parsed.color && swatch.name?.toLowerCase().includes("color")) {
          parsed.color = selectionName;
        }
        if (selectionName && !parsed.size && swatch.name?.toLowerCase().includes("size")) {
          parsed.size = selectionName;
        }
        if (
          selectionName &&
          !parsed.packLabel &&
          (swatch.name?.toLowerCase().includes("pack") ||
            swatch.name?.toLowerCase().includes("count"))
        ) {
          parsed.packLabel = selectionName;
        }

        const variantKey = (product.variants ?? []).join("|");
        const url = walmartUrlFromIds(
          baseUrl ?? undefined,
          pr.us_item_id,
          product.product_id,
        );

        pushRow({
          label: buildVariantLabel({
            color: parsed.color,
            size: parsed.size,
            packLabel: parsed.packLabel ?? (dimension && selectionName ? `${dimension}: ${selectionName}` : null),
          }),
          size: parsed.size,
          color: parsed.color,
          packLabel: parsed.packLabel,
          priceUsdCents: priceUsdToCents(product.price_map?.price),
          productUrl: url,
          imageUrl: heroImage,
          inStock: product.in_stock ?? null,
          isCurrent: variantKey.length > 0 && variantKey === currentKey,
          source: "walmart",
        });
      }
    }
  }

  if (rows.length === 0) {
    const parsed = parseVariantKeys(pr.variants);
    pushRow({
      label: buildVariantLabel(parsed),
      size: parsed.size,
      color: parsed.color,
      packLabel: parsed.packLabel,
      priceUsdCents: priceUsdToCents(pr.price_map?.price),
      productUrl: baseUrl,
      imageUrl: heroImage,
      inStock: pr.in_stock ?? null,
      isCurrent: true,
      source: "walmart",
    });
  }

  return rows;
}
