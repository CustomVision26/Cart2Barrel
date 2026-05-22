import { extractProductVariantsWithOpenAI } from "@/lib/ai/extract-product-variants-openai";
import { fetchPageHtmlForAi } from "@/lib/ai/fetch-page-for-ai";
import {
  parseProductUrl,
  type ParsedProductUrl,
} from "@/lib/product-url/retailer-id";
import { fetchAmazonVariants } from "@/lib/serpapi/amazon-product";
import { fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import { findShoppingImmersiveToken } from "@/lib/serpapi/google-shopping";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { fetchWalmartVariants } from "@/lib/serpapi/walmart-product";
import { displaySiteName, hostnameFromProductUrl } from "@/lib/site-name";

import type {
  FetchProductVariantsResult,
  ProductVariantOffer,
} from "./types";

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
  context?: { productSize?: string | null; productColor?: string | null },
): Promise<ProductVariantOffer[]> {
  const html = await fetchPageHtmlForAi(productUrl);
  const { variants } = await extractProductVariantsWithOpenAI(
    html,
    productUrl,
    context,
  );
  return variants;
}

async function fetchSerpApiRoute(
  parsed: ParsedProductUrl,
  productUrl: string,
  productId: string | null,
  asin: string | null,
): Promise<ProductVariantOffer[]> {
  if (parsed.kind === "walmart" && productId) {
    return fetchWalmartVariants(productId);
  }
  if (parsed.kind === "amazon" && asin) {
    return fetchAmazonVariants(parsed, asin);
  }
  return [];
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
      const serpRows = await fetchSerpApiRoute(
        parsed,
        productUrl,
        walmartId,
        asin,
      );
      if (serpRows.length > 0) {
        variants = serpRows;
        method =
          parsed.kind === "walmart" ? "walmart_product" : "amazon_product";
      }
    }

    if (hasSerp && variants.length < 2 && searchQuery.length >= 4) {
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
      parsed.kind === "generic" ||
      parsed.kind === "target" ||
      parsed.kind === "ebay" ||
      parsed.hostname.includes("temu.") ||
      parsed.hostname.includes("shein.");

    if (needsPageAi) {
      try {
        const pageRows = await fetchFromPageAi(productUrl, {
          productSize: input.productSize ?? null,
          productColor: input.productColor ?? null,
        });
        if (pageRows.length > 0) {
          variants =
            variants.length > 0
              ? mergeVariants(variants, pageRows)
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

    return {
      ok: true,
      retailer: retailer || host || "Store",
      variants: capVariants(variants),
      method: method || "unknown",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Variant lookup failed.";
    return { ok: false, message: msg };
  }
}
