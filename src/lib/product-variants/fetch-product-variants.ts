import { extractProductVariantsWithOpenAI } from "@/lib/ai/extract-product-variants-openai";
import { fetchPageHtmlForAi } from "@/lib/ai/fetch-page-for-ai";
import {
  parseProductUrl,
  type ParsedProductUrl,
} from "@/lib/product-url/retailer-id";
import {
  fetchAmazonProductSummary,
  fetchAmazonVariants,
} from "@/lib/serpapi/amazon-product";
import { fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import { findShoppingImmersiveToken } from "@/lib/serpapi/google-shopping";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { isDirectListingRetailer } from "@/lib/product-variants/direct-listing-hosts";
import { mergeVariantsPreferPageAi } from "@/lib/product-variants/merge-variants-prefer-page-ai";
import { mergeWalmartVariantsWithPageAi } from "@/lib/product-variants/merge-walmart-variants";
import { extractSheinVariantsFromHtml } from "@/lib/product-variants/shein-from-page-html";
import {
  fetchWalmartProductSummary,
  fetchWalmartVariants,
} from "@/lib/serpapi/walmart-product";
import { displaySiteName, hostnameFromProductUrl } from "@/lib/site-name";

import { enrichVariantsWithListingTitle } from "@/lib/product-variants/enrich-listing-title";
import type {
  FetchProductVariantsResult,
  ProductVariantOffer,
} from "@/lib/product-variants/types";

const MAX_VARIANTS = 32;

function capVariants(rows: ProductVariantOffer[]): ProductVariantOffer[] {
  return rows.slice(0, MAX_VARIANTS);
}

function mergeVariants(
  primary: ProductVariantOffer[],
  secondary: ProductVariantOffer[],
): ProductVariantOffer[] {
  const out = [...primary];
  const seen = new Set(
    primary.map((r) => `${r.label}|${r.priceUsdCents}|${r.productUrl}`),
  );

  for (const row of secondary) {
    const key = `${row.label}|${row.priceUsdCents}|${row.productUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...row, id: `merged-${out.length}` });
  }

  return capVariants(out);
}

async function fetchFromPageAi(
  productUrl: string,
  parsed: ParsedProductUrl,
  context?: { productSize?: string | null; productColor?: string | null },
): Promise<ProductVariantOffer[]> {
  const html = await fetchPageHtmlForAi(productUrl);

  if (parsed.hostname.toLowerCase().includes("shein.")) {
    const sheinRows = extractSheinVariantsFromHtml(html, productUrl);
    if (sheinRows.length > 0) return sheinRows;
  }

  const { variants } = await extractProductVariantsWithOpenAI(
    html,
    productUrl,
    context,
  );
  return variants;
}

async function fetchWalmartWithPagePrices(
  productUrl: string,
  parsed: ParsedProductUrl,
  walmartId: string,
  context?: {
    productName?: string;
    productSize?: string;
    productColor?: string;
  },
): Promise<{ variants: ProductVariantOffer[]; pageAiUsed: boolean }> {
  const serpRows = await fetchWalmartVariants(walmartId);
  try {
    const pageRows = await fetchFromPageAi(productUrl, parsed, {
      productSize: context?.productSize ?? null,
      productColor: context?.productColor ?? null,
    });
    if (pageRows.length === 0) {
      return { variants: serpRows, pageAiUsed: false };
    }
    return {
      variants: mergeWalmartVariantsWithPageAi(serpRows, pageRows),
      pageAiUsed: true,
    };
  } catch {
    return { variants: serpRows, pageAiUsed: false };
  }
}

async function fetchSerpApiRoute(
  parsed: ParsedProductUrl,
  productUrl: string,
  productId: string | null,
  asin: string | null,
  context?: {
    productName?: string;
    productSize?: string;
    productColor?: string;
  },
): Promise<{ variants: ProductVariantOffer[]; method: string }> {
  if (parsed.kind === "walmart" && productId) {
    const { variants, pageAiUsed } = await fetchWalmartWithPagePrices(
      productUrl,
      parsed,
      productId,
      context,
    );
    return {
      variants,
      method: pageAiUsed ? "walmart_product+page_ai" : "walmart_product",
    };
  }
  if (parsed.kind === "amazon" && asin) {
    return {
      variants: await fetchAmazonVariants(parsed, asin),
      method: "amazon_product",
    };
  }
  return { variants: [], method: "" };
}

async function fetchImmersiveFallback(
  parsed: ParsedProductUrl,
  productUrl: string,
  searchQuery: string,
): Promise<ProductVariantOffer[]> {
  const { token, productUrl: hitUrl } = await findShoppingImmersiveToken({
    query: searchQuery,
    retailerHostname: parsed.hostname,
  });
  if (!token) return [];

  return fetchImmersiveProductVariants(token, {
    retailerHostname: parsed.hostname,
    fallbackProductUrl: hitUrl ?? productUrl,
  });
}

export async function fetchProductVariants(input: {
  productUrl: string;
  productName?: string;
  productSize?: string;
  productColor?: string;
}): Promise<FetchProductVariantsResult> {
  const productUrl = input.productUrl.trim();
  const parsed = parseProductUrl(productUrl);
  if (!parsed) {
    return { ok: false, message: "Enter a valid https product URL." };
  }

  const retailer = displaySiteName(null, productUrl);
  const searchQuery = [
    input.productName?.trim(),
    input.productSize?.trim(),
    input.productColor?.trim(),
    retailer,
  ]
    .filter(Boolean)
    .join(" ");

  const hasSerp = Boolean(getSerpApiKey());
  const walmartId = parsed.walmartProductId;
  const asin = parsed.amazonAsin;

  let variants: ProductVariantOffer[] = [];
  let method = "";

  try {
    if (hasSerp && (parsed.kind === "walmart" || parsed.kind === "amazon")) {
      const serpResult = await fetchSerpApiRoute(
        parsed,
        productUrl,
        walmartId,
        asin,
        {
          productName: input.productName,
          productSize: input.productSize,
          productColor: input.productColor,
        },
      );
      if (serpResult.variants.length > 0) {
        variants = serpResult.variants;
        method = serpResult.method;
      }
    }

    const serpListingResolved =
      (parsed.kind === "walmart" || parsed.kind === "amazon") &&
      (method.includes("walmart_product") || method.includes("amazon_product"));

    const skipImmersive = isDirectListingRetailer(parsed);

    if (
      hasSerp &&
      variants.length < 2 &&
      searchQuery.length >= 4 &&
      !serpListingResolved &&
      !skipImmersive
    ) {
      const immersiveRows = await fetchImmersiveFallback(
        parsed,
        productUrl,
        searchQuery,
      );
      if (immersiveRows.length > 0) {
        variants =
          variants.length > 0
            ? mergeVariants(variants, immersiveRows)
            : immersiveRows;
        method = method ? `${method}+immersive` : "google_immersive_product";
      }
    }

    const needsPageAi =
      variants.length < 2 ||
      (parsed.kind === "walmart" && !method.includes("page_ai")) ||
      parsed.kind === "generic" ||
      parsed.kind === "target" ||
      parsed.kind === "ebay" ||
      parsed.hostname.includes("temu.") ||
      parsed.hostname.includes("shein.");

    if (needsPageAi) {
      try {
        const pageRows = await fetchFromPageAi(productUrl, parsed, {
          productSize: input.productSize ?? null,
          productColor: input.productColor ?? null,
        });
        if (pageRows.length > 0) {
          variants =
            variants.length > 0
              ? mergeVariantsPreferPageAi(variants, pageRows)
              : pageRows;
          method = method ? `${method}+page_ai` : "page_ai";
        }
      } catch (pageErr) {
        if (variants.length === 0) {
          const msg =
            pageErr instanceof Error ? pageErr.message : "Could not read product page.";
          return { ok: false, message: msg };
        }
      }
    }

    if (variants.length === 0) {
      return {
        ok: false,
        message:
          "No variants found for this listing. Try Fill details with AI, or a direct Walmart/Amazon product link.",
      };
    }

    const host = hostnameFromProductUrl(productUrl);
    for (const row of variants) {
      if (!row.productUrl && productUrl) {
        row.productUrl = productUrl;
      }
      if (row.isCurrent) continue;
      const sizeMatch =
        !input.productSize?.trim() ||
        row.size?.toLowerCase() === input.productSize.trim().toLowerCase();
      const colorMatch =
        !input.productColor?.trim() ||
        row.color?.toLowerCase() === input.productColor.trim().toLowerCase();
      if (sizeMatch && colorMatch && input.productSize && input.productColor) {
        row.isCurrent = true;
      }
    }

    let listingTitle: string | null = null;
    let listingImageUrl: string | null = null;
    if (hasSerp && parsed.kind === "walmart" && walmartId) {
      try {
        const summary = await fetchWalmartProductSummary(walmartId);
        listingTitle = summary.title;
        listingImageUrl = summary.imageUrl;
      } catch {
        /* variant rows still usable */
      }
    } else if (hasSerp && parsed.kind === "amazon" && asin) {
      try {
        const summary = await fetchAmazonProductSummary(asin, parsed.amazonDomain);
        listingTitle = summary.title;
        listingImageUrl = summary.imageUrl;
      } catch {
        /* variant rows still usable */
      }
    }

    return {
      ok: true,
      retailer: retailer || host || "Store",
      variants: enrichVariantsWithListingTitle(
        capVariants(variants),
        listingTitle,
      ),
      method: method || "unknown",
      listingTitle,
      listingImageUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Variant lookup failed.";
    return { ok: false, message: msg };
  }
}
