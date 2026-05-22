import { compareRetailerPrices, type RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { parseProductUrl } from "@/lib/product-url/retailer-id";
import { fetchAmazonProductSummary } from "@/lib/serpapi/amazon-product";
import { getSerpApiKey, serpApiNotConfiguredMessage } from "@/lib/serpapi/env";
import { fetchWalmartProductSummary } from "@/lib/serpapi/walmart-product";
import { hostnameFromProductUrl } from "@/lib/site-name";

export type AdminSpotlightPrimaryFields = {
  productUrl: string;
  productName: string;
  priceUsdCents: number | null;
  imageUrl: string | null;
  productSize: string | null;
  productColor: string | null;
};

export type AdminSpotlightSerpApiResolveResult =
  | {
      ok: true;
      primary: AdminSpotlightPrimaryFields;
      variants: ProductVariantOffer[];
      variantMethod: string;
      variantRetailer: string;
      compareOffers: RetailerPriceOffer[];
      compareSearchQuery: string;
      compareMessage: string | null;
    }
  | { ok: false; message: string };

function centsToUsdString(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export function adminSpotlightPriceUsdFromCents(cents: number | null): string {
  return centsToUsdString(cents);
}

export async function resolveAdminSpotlightFromSerpApi(
  productUrl: string,
): Promise<AdminSpotlightSerpApiResolveResult> {
  const url = productUrl.trim();
  if (!url || !/^https:\/\//i.test(url)) {
    return { ok: false, message: "Enter a valid https product URL." };
  }

  if (!getSerpApiKey()) {
    return { ok: false, message: serpApiNotConfiguredMessage() };
  }

  const parsed = parseProductUrl(url);
  if (!parsed) {
    return { ok: false, message: "Could not parse product URL." };
  }

  let productName = "";
  let priceUsdCents: number | null = null;
  let imageUrl: string | null = null;
  let productSize: string | null = null;
  let productColor: string | null = null;
  let resolvedUrl = url;

  try {
    if (parsed.kind === "walmart" && parsed.walmartProductId) {
      const summary = await fetchWalmartProductSummary(parsed.walmartProductId);
      productName = summary.title ?? "";
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
    } else if (parsed.kind === "amazon" && parsed.amazonAsin) {
      const summary = await fetchAmazonProductSummary(
        parsed.amazonAsin,
        parsed.amazonDomain,
      );
      productName = summary.title ?? "";
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
    }
  } catch {
    // Fall through to variant / compare paths.
  }

  const variantResult = await fetchProductVariants({
    productUrl: resolvedUrl,
    productName: productName || undefined,
    productSize: productSize ?? undefined,
    productColor: productColor ?? undefined,
  });

  let variants: ProductVariantOffer[] = [];
  let variantMethod = "";
  let variantRetailer = hostnameFromProductUrl(resolvedUrl) ?? "Store";

  if (variantResult.ok) {
    variants = variantResult.variants;
    variantMethod = variantResult.method;
    variantRetailer = variantResult.retailer;
    const pick = variants.find((v) => v.isCurrent) ?? variants[0];
    if (pick) {
      if (!productName || productName.length < 2) {
        productName = pick.label;
      }
      priceUsdCents = priceUsdCents ?? pick.priceUsdCents;
      imageUrl = imageUrl ?? pick.imageUrl;
      productSize = productSize ?? pick.size;
      productColor = productColor ?? pick.color;
      if (pick.productUrl) resolvedUrl = pick.productUrl;
    }
  }

  if (!productName || productName.length < 2) {
    productName = hostnameFromProductUrl(resolvedUrl) ?? "Product";
  }

  const primary: AdminSpotlightPrimaryFields = {
    productUrl: resolvedUrl,
    productName,
    priceUsdCents,
    imageUrl,
    productSize,
    productColor,
  };

  let compareOffers: RetailerPriceOffer[] = [];
  let compareSearchQuery = "";
  let compareMessage: string | null = null;

  const compare = await compareRetailerPrices({
    productName: primary.productName,
    productSize: primary.productSize ?? undefined,
    productColor: primary.productColor ?? undefined,
    originalProductUrl: primary.productUrl,
    originalRetailer: variantRetailer,
    originalPriceUsdCents: primary.priceUsdCents ?? undefined,
    originalImageUrl: primary.imageUrl ?? undefined,
  });

  if (compare.ok) {
    compareOffers = compare.offers;
    compareSearchQuery = compare.searchQuery;
  } else {
    compareMessage = compare.message;
  }

  return {
    ok: true,
    primary,
    variants,
    variantMethod: variantMethod || (variantResult.ok ? variantResult.method : ""),
    variantRetailer,
    compareOffers,
    compareSearchQuery,
    compareMessage,
  };
}
