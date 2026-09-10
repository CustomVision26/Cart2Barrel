import { compareRetailerPrices, type RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import { priceUsdToCents } from "@/lib/product-variants/labels";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import {
  amazonProductUrl,
  isIncompleteAmazonDpUrl,
  isIncompleteEbayItemUrl,
  isIncompleteTargetProductUrl,
  isIncompleteWalmartIpUrl,
  isWalmartBrowseOrSearchUrl,
  parseProductUrl,
  walmartProductUrl,
} from "@/lib/product-url/retailer-id";
import { titleHintFromProductUrl } from "@/lib/product-url/search-query";
import {
  fetchAmazonProductSummary,
  resolveAmazonAsinForLookup,
} from "@/lib/serpapi/amazon-product";
import { getSerpApiKey, serpApiNotConfiguredMessage } from "@/lib/serpapi/env";
import { findShoppingListingForRetailer } from "@/lib/serpapi/google-shopping";
import { isSerpApiRateLimitError, SERPAPI_RATE_LIMIT_MESSAGE } from "@/lib/serpapi/http";
import {
  fetchWalmartProductSummary,
  resolveWalmartProductIdForLookup,
} from "@/lib/serpapi/walmart-product";
import {
  fillMissingVariantImages,
  usableRetailerProductImageUrl,
} from "@/lib/product-variants/variant-images";
import { hostnameFromProductUrl, retailerLabelFromProductUrl } from "@/lib/site-name";

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

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

function looksLikeHostnameName(name: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name.trim());
}

function lookupFailureMessage(input: {
  productUrl: string;
  listingError: string | null;
  variantMessage: string | null;
}): string {
  const parts: string[] = [];
  if (isIncompleteAmazonDpUrl(input.productUrl)) {
    parts.push(
      "This Amazon URL looks incomplete (missing a 10-character ASIN after /dp/). Paste the full product page, such as https://www.amazon.com/dp/B0XXXXXXXX.",
    );
  }
  if (isIncompleteWalmartIpUrl(input.productUrl) || isWalmartBrowseOrSearchUrl(input.productUrl)) {
    parts.push(
      "This Walmart URL is missing the numeric item ID after /ip/. Paste the full product page, such as https://www.walmart.com/ip/Product-Name/123456789.",
    );
  }
  if (isIncompleteTargetProductUrl(input.productUrl)) {
    parts.push(
      "This Target URL is missing the product number (/p/…/-/A-12345678). Paste the full product page.",
    );
  }
  if (isIncompleteEbayItemUrl(input.productUrl)) {
    parts.push(
      "This eBay URL is missing the item number after /itm/. Paste the full listing URL.",
    );
  }
  if (input.listingError) parts.push(input.listingError);
  if (
    input.variantMessage &&
    input.variantMessage !== input.listingError
  ) {
    parts.push(input.variantMessage);
  }
  if (
    parts.some((p) => isSerpApiRateLimitError(p)) &&
    !parts.includes(SERPAPI_RATE_LIMIT_MESSAGE)
  ) {
    parts.push(SERPAPI_RATE_LIMIT_MESSAGE);
  }
  const retailer = retailerLabelFromProductUrl(input.productUrl);
  return (
    parts.join(" ") ||
    `SerpApi did not return this ${retailer} product. Paste a full product page URL (not a search, store, or truncated link) and try again.`
  );
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

  const slugName = titleHintFromProductUrl(url);
  const retailerLabel = retailerLabelFromProductUrl(url);
  let productName = "";
  let priceUsdCents: number | null = null;
  let imageUrl: string | null = null;
  let productSize: string | null = null;
  let productColor: string | null = null;
  let resolvedUrl = url;
  let amazonAsin = parsed.amazonAsin;
  let walmartProductId = parsed.walmartProductId;
  let listingFromSerp = false;
  let listingError: string | null = null;

  if (parsed.kind === "amazon" && !amazonAsin) {
    try {
      amazonAsin = await resolveAmazonAsinForLookup({
        productUrl: url,
        amazonDomain: parsed.amazonDomain,
        productName: slugName,
      });
      if (amazonAsin) {
        resolvedUrl = amazonProductUrl(amazonAsin, parsed.amazonDomain);
      }
    } catch (err) {
      listingError = errorMessage(err, "Amazon ASIN lookup failed.");
    }
  }

  if (parsed.kind === "walmart" && !walmartProductId) {
    try {
      walmartProductId = await resolveWalmartProductIdForLookup({
        productUrl: url,
        productName: slugName,
      });
      if (walmartProductId) {
        resolvedUrl = walmartProductUrl(walmartProductId);
      }
    } catch (err) {
      listingError = errorMessage(err, "Walmart item lookup failed.");
    }
  }

  if (isSerpApiRateLimitError(listingError)) {
    return {
      ok: false,
      message: lookupFailureMessage({
        productUrl: url,
        listingError,
        variantMessage: null,
      }),
    };
  }

  try {
    if (parsed.kind === "walmart" && walmartProductId) {
      const summary = await fetchWalmartProductSummary(walmartProductId);
      productName = summary.title ?? "";
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
      listingFromSerp = Boolean(
        productName.length >= 2 || priceUsdCents || imageUrl,
      );
    } else if (parsed.kind === "amazon" && amazonAsin) {
      const summary = await fetchAmazonProductSummary(
        amazonAsin,
        parsed.amazonDomain,
      );
      productName = summary.title ?? "";
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
      listingFromSerp = Boolean(
        productName.length >= 2 || priceUsdCents || imageUrl,
      );
    }
  } catch (err) {
    listingError = errorMessage(err, "Product lookup failed.");
  }

  if (isSerpApiRateLimitError(listingError) && !listingFromSerp) {
    return {
      ok: false,
      message: lookupFailureMessage({
        productUrl: url,
        listingError,
        variantMessage: null,
      }),
    };
  }

  const variantResult = await fetchProductVariants({
    productUrl: resolvedUrl,
    productName: productName || slugName || undefined,
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
    imageUrl =
      usableRetailerProductImageUrl(imageUrl) ??
      usableRetailerProductImageUrl(variantResult.listingImageUrl);
    const pick = variants.find((v) => v.isCurrent) ?? variants[0];
    if (pick) {
      const pickTitle = pick.productTitle?.trim() || pick.label;
      if (!productName || productName.length < 2) {
        productName = pickTitle;
      }
      priceUsdCents = priceUsdCents ?? pick.priceUsdCents;
      imageUrl = imageUrl ?? usableRetailerProductImageUrl(pick.imageUrl);
      productSize = productSize ?? pick.size;
      productColor = productColor ?? pick.color;
      if (pick.productUrl) resolvedUrl = pick.productUrl;
      listingFromSerp =
        listingFromSerp || Boolean(pickTitle || pick.priceUsdCents || pick.imageUrl);
    }
    if (variantResult.listingTitle?.trim() && (!productName || productName.length < 2)) {
      productName = variantResult.listingTitle.trim();
      listingFromSerp = true;
    }
  }

  const needsShoppingImage = !usableRetailerProductImageUrl(imageUrl);
  if (
    (!listingFromSerp || needsShoppingImage) &&
    !isSerpApiRateLimitError(variantResult.ok ? null : variantResult.message) &&
    (slugName || productName) &&
    !looksLikeHostnameName(productName || slugName || "")
  ) {
    try {
      const hit = await findShoppingListingForRetailer({
        query: [productName, slugName, retailerLabel].filter(Boolean).join(" "),
        retailerHostname: parsed.hostname,
      });
      if (hit) {
        if (!listingFromSerp) {
          if (!productName || productName.length < 2) {
            productName = hit.title;
          }
          priceUsdCents = priceUsdCents ?? priceUsdToCents(hit.priceUsd);
          if (hit.productUrl) resolvedUrl = hit.productUrl;
          listingFromSerp = true;
        }
        imageUrl =
          usableRetailerProductImageUrl(imageUrl) ??
          usableRetailerProductImageUrl(hit.imageUrl);
      }
    } catch (err) {
      listingError = listingError ?? errorMessage(err, "Shopping lookup failed.");
    }
  }

  if (!productName || productName.length < 2 || looksLikeHostnameName(productName)) {
    productName = slugName ?? "";
  }

  const hasListing =
    listingFromSerp ||
    (priceUsdCents != null && priceUsdCents > 0) ||
    Boolean(imageUrl) ||
    variants.length > 0;

  if (!hasListing || !productName || looksLikeHostnameName(productName)) {
    return {
      ok: false,
      message: lookupFailureMessage({
        productUrl: url,
        listingError,
        variantMessage: variantResult.ok ? null : variantResult.message,
      }),
    };
  }

  const primary: AdminSpotlightPrimaryFields = {
    productUrl: resolvedUrl,
    productName,
    priceUsdCents,
    imageUrl: usableRetailerProductImageUrl(imageUrl),
    productSize,
    productColor,
  };

  variants = fillMissingVariantImages(variants, primary.imageUrl);

  let compareOffers: RetailerPriceOffer[] = [];
  let compareSearchQuery = "";
  let compareMessage: string | null = null;

  if (looksLikeHostnameName(primary.productName)) {
    compareMessage = "Skipped retailer comparison because the product name is missing.";
  } else if (isSerpApiRateLimitError(listingError) || isSerpApiRateLimitError(variantResult.ok ? null : variantResult.message)) {
    compareMessage =
      "Retailer comparison skipped so this listing could load. SerpApi already rate-limited this API key (shared across all admin browsers).";
  } else {
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
