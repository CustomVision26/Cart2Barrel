import { compareRetailerPrices, type RetailerPriceOffer } from "@/lib/retailer-price-compare";
import {
  hostnameLikelyBlocksHtmlFetch,
  isRetailerPageFetchRedirectMessage,
  RETAILER_PAGE_REDIRECT_USER_MESSAGE,
} from "@/lib/ai/fetch-page-for-ai";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import { priceUsdToCents } from "@/lib/product-variants/labels";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import type { SerpShoppingResult } from "@/lib/serpapi/google-shopping";
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
import { listingMatchesExpectedProduct, titleHintFromProductUrl } from "@/lib/product-url/search-query";
import {
  isGoogleHostedProductUrl,
  listingUrlMatchesRetailer,
} from "@/lib/product-url/listing-url";
import {
  fetchAmazonProductSummary,
  resolveAmazonAsinForLookup,
} from "@/lib/serpapi/amazon-product";
import { getSerpApiKey, serpApiNotConfiguredMessage } from "@/lib/serpapi/env";
import {
  findShoppingListingForRetailer,
  searchShoppingHitsForRetailer,
} from "@/lib/serpapi/google-shopping";
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

function sanitizeLookupPart(message: string | null): string | null {
  if (!message) return null;
  if (isRetailerPageFetchRedirectMessage(message)) {
    return RETAILER_PAGE_REDIRECT_USER_MESSAGE;
  }
  return message;
}

function applyShoppingHit(
  hit: SerpShoppingResult,
  state: {
    productName: string;
    priceUsdCents: number | null;
    imageUrl: string | null;
    resolvedUrl: string;
    originalHost: string;
  },
): {
  productName: string;
  priceUsdCents: number | null;
  imageUrl: string | null;
  resolvedUrl: string;
} {
  let productName = state.productName;
  if (!productName || productName.length < 2 || looksLikeHostnameName(productName)) {
    productName = hit.title;
  }
  return {
    productName,
    priceUsdCents: state.priceUsdCents ?? priceUsdToCents(hit.priceUsd),
    imageUrl:
      usableRetailerProductImageUrl(state.imageUrl) ??
      usableRetailerProductImageUrl(hit.imageUrl),
    resolvedUrl:
      hit.productUrl && listingUrlMatchesRetailer(state.originalHost, hit.productUrl)
        ? hit.productUrl
        : state.resolvedUrl,
  };
}

async function variantsFromShoppingHit(
  hit: SerpShoppingResult,
  hostname: string,
  productUrl: string,
): Promise<{ variants: ProductVariantOffer[]; method: string }> {
  const token = hit.immersiveProductPageToken;
  if (!token) {
    return { variants: [], method: "google_shopping" };
  }
  try {
    const variants = await fetchImmersiveProductVariants(token, {
      retailerHostname: hostname,
      fallbackProductUrl:
        hit.productUrl && !isGoogleHostedProductUrl(hit.productUrl)
          ? hit.productUrl
          : productUrl,
    });
    const title =
      variants.find((r) => r.productTitle?.trim())?.productTitle ??
      variants[0]?.label ??
      hit.title;
    if (!listingMatchesExpectedProduct(title, hit.title)) {
      return { variants: [], method: "google_shopping" };
    }
    return {
      variants: variants.map((row) => ({
        ...row,
        productUrl:
          row.productUrl && !isGoogleHostedProductUrl(row.productUrl)
            ? row.productUrl
            : productUrl,
      })),
      method:
        variants.length > 0 ? "google_shopping+immersive" : "google_shopping",
    };
  } catch {
    return { variants: [], method: "google_shopping" };
  }
}

function compareOffersFromShoppingHits(
  hits: SerpShoppingResult[],
  original: {
    productUrl: string;
    retailer: string;
    productName: string;
    priceUsdCents: number | null;
    imageUrl: string | null;
  },
): RetailerPriceOffer[] {
  const offers: RetailerPriceOffer[] = [];
  const seenUrls = new Set<string>();
  const seenRetailers = new Set<string>();

  const push = (offer: RetailerPriceOffer) => {
    const urlKey = offer.productUrl.trim().toLowerCase();
    const retailerKey = offer.retailer.trim().toLowerCase().replace(/\s+/g, " ");
    if (seenUrls.has(urlKey)) return;
    if (!offer.isOriginal && seenRetailers.has(retailerKey)) return;
    seenUrls.add(urlKey);
    if (!offer.isOriginal) seenRetailers.add(retailerKey);
    offers.push(offer);
  };

  push({
    id: "original",
    retailer: original.retailer,
    title: original.productName,
    productUrl: original.productUrl,
    priceUsdCents: original.priceUsdCents,
    imageUrl: original.imageUrl,
    matchConfidence: null,
    aiVerified: true,
    isOriginal: true,
  });

  hits.forEach((hit, i) => {
    if (isGoogleHostedProductUrl(hit.productUrl)) return;
    push({
      id: `shop-${i}`,
      retailer: hit.retailer,
      title: hit.title,
      productUrl: hit.productUrl,
      priceUsdCents: priceUsdToCents(hit.priceUsd),
      imageUrl: usableRetailerProductImageUrl(hit.imageUrl),
      matchConfidence: null,
      aiVerified: false,
      isOriginal: false,
    });
  });

  return offers;
}

function lookupFailureMessage(input: {
  productUrl: string;
  listingError: string | null;
  variantMessage: string | null;
}): string {
  const listingError = sanitizeLookupPart(input.listingError);
  const variantMessage = sanitizeLookupPart(input.variantMessage);
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
  if (listingError) parts.push(listingError);
  if (variantMessage && variantMessage !== listingError) {
    parts.push(variantMessage);
  }
  if (
    parts.some((p) => isSerpApiRateLimitError(p)) &&
    !parts.includes(SERPAPI_RATE_LIMIT_MESSAGE)
  ) {
    parts.push(SERPAPI_RATE_LIMIT_MESSAGE);
  }
  const retailer = retailerLabelFromProductUrl(input.productUrl);
  if (hostnameLikelyBlocksHtmlFetch(hostnameFromProductUrl(input.productUrl) ?? "")) {
    return (
      parts.join(" ") ||
      `SerpApi has no ${retailer} product API (Amazon and Walmart have dedicated engines; this store does not). Google Shopping did not return a matching ${retailer} listing, and the store blocks server page reads. Keep this URL and fill name, price, and image from the product page.`
    );
  }
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
  let shoppingHit: SerpShoppingResult | null = null;
  let shoppingHits: SerpShoppingResult[] = [];
  let shoppingQuery = "";

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

  if (
    !listingFromSerp &&
    (slugName || productName) &&
    !looksLikeHostnameName(productName || slugName || "")
  ) {
    try {
      shoppingQuery = [productName, slugName, retailerLabel]
        .filter(Boolean)
        .join(" ");
      const { match, hits } = await searchShoppingHitsForRetailer({
        query: shoppingQuery,
        retailerHostname: parsed.hostname,
      });
      shoppingHits = hits;
      if (match) {
        const applied = applyShoppingHit(match, {
          productName,
          priceUsdCents,
          imageUrl,
          resolvedUrl,
          originalHost: parsed.hostname,
        });
        productName = applied.productName;
        priceUsdCents = applied.priceUsdCents;
        imageUrl = applied.imageUrl;
        resolvedUrl = applied.resolvedUrl;
        listingFromSerp = true;
        shoppingHit = match;
      }
    } catch (err) {
      listingError = listingError ?? errorMessage(err, "Shopping lookup failed.");
    }
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

  let variants: ProductVariantOffer[] = [];
  let variantMethod = "";
  let variantRetailer = hostnameFromProductUrl(resolvedUrl) ?? "Store";
  let variantFailureMessage: string | null = null;

  const mergeVariantRows = (
    rows: ProductVariantOffer[],
    method: string,
    opts?: {
      retailer?: string;
      listingTitle?: string | null;
      listingImageUrl?: string | null;
    },
  ) => {
    if (
      rows.length > 0 &&
      (productName || slugName) &&
      !listingMatchesExpectedProduct(
        opts?.listingTitle?.trim() ||
          rows.find((r) => r.productTitle?.trim())?.productTitle ||
          rows[0]?.label,
        productName || slugName,
      )
    ) {
      return;
    }
    variants = rows;
    variantMethod = method;
    if (opts?.retailer) variantRetailer = opts.retailer;
    imageUrl =
      usableRetailerProductImageUrl(imageUrl) ??
      usableRetailerProductImageUrl(opts?.listingImageUrl);
    const pick = variants.find((v) => v.isCurrent) ?? variants[0];
    if (pick) {
      const pickTitle = pick.productTitle?.trim() || pick.label;
      const expectedName = productName || slugName || "";
      const titleOk = listingMatchesExpectedProduct(pickTitle, expectedName);
      if (titleOk && (!productName || productName.length < 2)) {
        productName = pickTitle;
      }
      if (titleOk) {
        priceUsdCents = priceUsdCents ?? pick.priceUsdCents;
        imageUrl = imageUrl ?? usableRetailerProductImageUrl(pick.imageUrl);
        productSize = productSize ?? pick.size;
        productColor = productColor ?? pick.color;
      }
      if (
        pick.productUrl &&
        listingUrlMatchesRetailer(parsed.hostname, pick.productUrl)
      ) {
        resolvedUrl = pick.productUrl;
      }
      listingFromSerp =
        listingFromSerp ||
        (titleOk && Boolean(pickTitle || pick.priceUsdCents || pick.imageUrl));
    }
    if (
      opts?.listingTitle?.trim() &&
      listingMatchesExpectedProduct(opts.listingTitle, productName || slugName) &&
      (!productName || productName.length < 2)
    ) {
      productName = opts.listingTitle.trim();
      listingFromSerp = true;
    }
  };

  if (shoppingHit) {
    if (
      shoppingHit.immersiveProductPageToken &&
      !hostnameLikelyBlocksHtmlFetch(parsed.hostname)
    ) {
      const fromHit = await variantsFromShoppingHit(
        shoppingHit,
        parsed.hostname,
        resolvedUrl,
      );
      mergeVariantRows(fromHit.variants, fromHit.method);
    } else {
      variantMethod = "google_shopping";
    }
  } else if (!hostnameLikelyBlocksHtmlFetch(parsed.hostname)) {
    const variantResult = await fetchProductVariants({
      productUrl: resolvedUrl,
      productName: productName || slugName || undefined,
      productSize: productSize ?? undefined,
      productColor: productColor ?? undefined,
    });

    if (variantResult.ok) {
      mergeVariantRows(variantResult.variants, variantResult.method, {
        retailer: variantResult.retailer,
        listingTitle: variantResult.listingTitle,
        listingImageUrl: variantResult.listingImageUrl,
      });
    } else {
      variantFailureMessage = variantResult.message;
    }

    const needsShoppingImage = !usableRetailerProductImageUrl(imageUrl);
    if (
      (!listingFromSerp || needsShoppingImage) &&
      !isSerpApiRateLimitError(variantFailureMessage) &&
      (slugName || productName) &&
      !looksLikeHostnameName(productName || slugName || "")
    ) {
      try {
        const hit = await findShoppingListingForRetailer({
          query: [productName, slugName, retailerLabel].filter(Boolean).join(" "),
          retailerHostname: parsed.hostname,
        });
        if (hit) {
          const applied = applyShoppingHit(hit, {
            productName,
            priceUsdCents,
            imageUrl,
            resolvedUrl,
            originalHost: parsed.hostname,
          });
          if (!listingFromSerp) {
            productName = applied.productName;
            priceUsdCents = applied.priceUsdCents;
            resolvedUrl = applied.resolvedUrl;
            listingFromSerp = true;
          }
          imageUrl = applied.imageUrl;
        }
      } catch (err) {
        listingError = listingError ?? errorMessage(err, "Shopping lookup failed.");
      }
    }
  } else {
    variantMethod = "google_shopping";
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
        variantMessage: variantFailureMessage,
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
  } else if (
    isSerpApiRateLimitError(listingError) ||
    isSerpApiRateLimitError(variantFailureMessage)
  ) {
    compareMessage =
      "Retailer comparison skipped so this listing could load. SerpApi already rate-limited this API key (shared across all admin browsers).";
  } else if (shoppingHits.length > 0) {
    compareOffers = compareOffersFromShoppingHits(shoppingHits, {
      productUrl: primary.productUrl,
      retailer: variantRetailer,
      productName: primary.productName,
      priceUsdCents: primary.priceUsdCents,
      imageUrl: primary.imageUrl,
    });
    compareSearchQuery = shoppingQuery;
  } else if (hostnameLikelyBlocksHtmlFetch(parsed.hostname)) {
    compareMessage =
      "Retailer comparison skipped for this store. SerpApi has no product API here; fill name and price from the product page if Google Shopping did not match.";
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
    variantMethod,
    variantRetailer,
    compareOffers,
    compareSearchQuery,
    compareMessage,
  };
}
