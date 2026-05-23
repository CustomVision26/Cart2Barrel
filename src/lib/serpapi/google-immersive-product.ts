import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { buildVariantLabel, priceUsdToCents } from "@/lib/product-variants/labels";
import { serpApiGet } from "@/lib/serpapi/http";

type ImmersiveVariantItem = {
  name?: string;
  selected?: boolean;
  available?: boolean;
  serpapi_link?: string;
};

type ImmersiveVariantGroup = {
  title?: string;
  items?: ImmersiveVariantItem[];
};

type ImmersiveMoreOption = {
  title?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  serpapi_link?: string;
};

type ImmersiveProductResponse = {
  product_results?: {
    title?: string;
    price_range?: string;
    thumbnails?: string[];
    stores?: Array<{
      name?: string;
      link?: string;
      title?: string;
      price?: string;
      extracted_price?: number;
    }>;
    variants?: ImmersiveVariantGroup[];
    more_options?: ImmersiveMoreOption[];
  };
};

function parsePriceFromRow(raw: {
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

/**
 * Google Immersive Product popup — variants + more_options (multipack siblings).
 */
export async function fetchImmersiveProductVariants(
  pageToken: string,
  opts?: { retailerHostname?: string; fallbackProductUrl?: string },
): Promise<ProductVariantOffer[]> {
  const data = await serpApiGet<ImmersiveProductResponse>({
    engine: "google_immersive_product",
    page_token: pageToken,
    more_stores: "true",
  });

  const pr = data.product_results;
  if (!pr) return [];

  const host = opts?.retailerHostname?.toLowerCase();
  const store =
    host ?
      (pr.stores ?? []).find((s) =>
        s.name?.toLowerCase().includes(host.replace(/^www\./, "").split(".")[0] ?? ""),
      )
    : (pr.stores ?? [])[0];

  const defaultUrl =
    store?.link?.trim() ||
    opts?.fallbackProductUrl?.trim() ||
    null;
  const defaultImage = pr.thumbnails?.[0]?.trim() || null;
  const defaultPrice = parsePriceFromRow(store ?? {});

  const rows: ProductVariantOffer[] = [];
  const seen = new Set<string>();

  const push = (row: Omit<ProductVariantOffer, "id" | "source">) => {
    const key = `${row.label}|${row.priceUsdCents}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      ...row,
      id: `immersive-${rows.length}`,
      source: "immersive",
    });
  };

  for (const group of pr.variants ?? []) {
    const dim = group.title?.trim() || "Option";
    for (const item of group.items ?? []) {
      const name = item.name?.trim();
      if (!name || name.toLowerCase().startsWith("any ")) continue;

      const isSize =
        dim.toLowerCase().includes("size") ||
        dim.toLowerCase().includes("pack") ||
        dim.toLowerCase().includes("count");
      const isColor =
        dim.toLowerCase().includes("color") ||
        dim.toLowerCase().includes("colour");

      push({
        label: buildVariantLabel({
          color: isColor ? name : null,
          size: isSize && !dim.toLowerCase().includes("pack") ? name : null,
          packLabel:
            dim.toLowerCase().includes("pack") || dim.toLowerCase().includes("count")
              ? name
              : null,
          extra: !isColor && !isSize ? `${dim}: ${name}` : null,
        }),
        size: isSize ? name : null,
        color: isColor ? name : null,
        packLabel:
          dim.toLowerCase().includes("pack") || dim.toLowerCase().includes("count")
            ? name
            : null,
        priceUsdCents: priceUsdToCents(defaultPrice),
        productUrl: defaultUrl,
        imageUrl: defaultImage,
        inStock: item.available ?? null,
        isCurrent: Boolean(item.selected),
      });
    }
  }

  for (const opt of pr.more_options ?? []) {
    const title = opt.title?.trim();
    if (!title) continue;
    push({
      label: title,
      size: null,
      color: null,
      packLabel: null,
      priceUsdCents: priceUsdToCents(parsePriceFromRow(opt)),
      productUrl: defaultUrl,
      imageUrl: opt.thumbnail?.trim() || defaultImage,
      inStock: true,
      isCurrent: false,
    });
  }

  if (rows.length === 0 && (defaultUrl || defaultPrice != null)) {
    push({
      label: pr.title?.trim() || "Current listing",
      size: null,
      color: null,
      packLabel: null,
      priceUsdCents: priceUsdToCents(defaultPrice),
      productUrl: defaultUrl,
      imageUrl: defaultImage,
      inStock: null,
      isCurrent: true,
    });
  }

  return rows;
}

export type ImmersiveStoreOffer = {
  retailer: string;
  title: string;
  productUrl: string;
  priceUsd: number | null;
  imageUrl: string | null;
};

/** "Across the web" seller rows from Google Immersive Product (real retailer URLs). */
export async function fetchImmersiveProductStoreOffers(
  pageToken: string,
): Promise<ImmersiveStoreOffer[]> {
  const data = await serpApiGet<ImmersiveProductResponse>({
    engine: "google_immersive_product",
    page_token: pageToken,
    more_stores: "true",
  });

  const pr = data.product_results;
  if (!pr?.stores?.length) return [];

  const heroImage = pr.thumbnails?.[0]?.trim() || null;
  const offers: ImmersiveStoreOffer[] = [];

  for (const store of pr.stores) {
    const productUrl = store.link?.trim();
    if (!productUrl || !/^https:\/\//i.test(productUrl)) continue;

    const retailer = store.name?.trim();
    const title = store.title?.trim() || pr.title?.trim();
    if (!retailer || !title) continue;

    offers.push({
      retailer,
      title,
      productUrl,
      priceUsd: parsePriceFromRow(store),
      imageUrl: heroImage,
    });
  }

  return offers;
}
