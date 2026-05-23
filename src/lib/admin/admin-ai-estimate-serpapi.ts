import type { AiProductExtraction } from "@/lib/ai/extract-product-openai";
import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { parseProductUrl } from "@/lib/product-url/retailer-id";
import { fetchAmazonProductSummary } from "@/lib/serpapi/amazon-product";
import { getSerpApiKey, serpApiNotConfiguredMessage } from "@/lib/serpapi/env";
import { fetchWalmartProductSummary } from "@/lib/serpapi/walmart-product";
import { displaySiteName, hostnameFromProductUrl } from "@/lib/site-name";

export type AdminAiSerpApiExtractInput = {
  productUrl: string;
  productName?: string | null;
  productSize?: string | null;
  productColor?: string | null;
};

export type AdminAiSerpApiExtractResult =
  | { ok: true; extraction: AiProductExtraction; method: string }
  | { ok: false; message: string };

function normalizeToken(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function pickVariantForContext(
  variants: ProductVariantOffer[],
  productSize?: string | null,
  productColor?: string | null,
): ProductVariantOffer | null {
  if (variants.length === 0) return null;

  const marked = variants.find((v) => v.isCurrent);
  if (marked) return marked;

  const sizeNorm = normalizeToken(productSize);
  const colorNorm = normalizeToken(productColor);
  if (!sizeNorm && !colorNorm) {
    return variants[0] ?? null;
  }

  let best: ProductVariantOffer | null = null;
  let bestScore = -1;

  for (const variant of variants) {
    let score = 0;
    const vColor = normalizeToken(variant.color);
    const vSize = normalizeToken(variant.size);

    if (colorNorm) {
      if (vColor === colorNorm) score += 4;
      else if (tokensMatch(vColor, colorNorm)) score += 2;
    }
    if (sizeNorm) {
      if (vSize === sizeNorm) score += 4;
      else if (tokensMatch(vSize, sizeNorm)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  }

  if (best && bestScore > 0) return best;
  return variants[0] ?? null;
}

function extractionHasUsefulData(extraction: AiProductExtraction): boolean {
  return Boolean(
    extraction.productName?.trim() ||
      extraction.unitPriceUsd != null ||
      extraction.productImageUrl?.trim(),
  );
}

function buildExtraction(params: {
  productName: string | null;
  retailer: string;
  priceUsdCents: number | null;
  imageUrl: string | null;
  productSize: string | null;
  productColor: string | null;
  method: string;
  variantLabel?: string | null;
}): AiProductExtraction {
  const name =
    params.productName?.trim() ||
    params.variantLabel?.trim() ||
    null;
  const notesParts = [`Loaded via SerpApi (${params.method}).`];
  if (params.productSize?.trim() || params.productColor?.trim()) {
    notesParts.push(
      `Matched staff variant: size ${params.productSize?.trim() || "—"}, color ${params.productColor?.trim() || "—"}.`,
    );
  }

  return {
    productName: name,
    siteName: params.retailer.trim() || null,
    unitPriceUsd:
      params.priceUsdCents != null && params.priceUsdCents > 0
        ? params.priceUsdCents / 100
        : null,
    productImageUrl: params.imageUrl?.trim() || null,
    color: params.productColor?.trim() || null,
    size: params.productSize?.trim() || null,
    notes: notesParts.join(" "),
  };
}

/**
 * Pull product title, image, and variant price from SerpApi using the listing URL
 * and optional staff-entered size/color context.
 */
export async function extractAdminAiProductWithSerpApi(
  input: AdminAiSerpApiExtractInput,
): Promise<AdminAiSerpApiExtractResult> {
  if (!getSerpApiKey()) {
    return { ok: false, message: serpApiNotConfiguredMessage() };
  }

  const productUrl = input.productUrl.trim();
  if (!/^https:\/\//i.test(productUrl)) {
    return { ok: false, message: "Enter a valid https product URL." };
  }

  const parsed = parseProductUrl(productUrl);
  if (!parsed) {
    return { ok: false, message: "Could not parse product URL for SerpApi." };
  }

  let productName = input.productName?.trim() || "";
  let priceUsdCents: number | null = null;
  let imageUrl: string | null = null;
  let productSize = input.productSize?.trim() || null;
  let productColor = input.productColor?.trim() || null;
  let resolvedUrl = productUrl;
  let retailer =
    displaySiteName(null, productUrl) ||
    hostnameFromProductUrl(productUrl) ||
    "Store";
  let summaryMethod = "";

  try {
    if (parsed.kind === "walmart" && parsed.walmartProductId) {
      const summary = await fetchWalmartProductSummary(parsed.walmartProductId);
      if (summary.title) productName = productName || summary.title;
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
      summaryMethod = "walmart_product";
    } else if (parsed.kind === "amazon" && parsed.amazonAsin) {
      const summary = await fetchAmazonProductSummary(
        parsed.amazonAsin,
        parsed.amazonDomain,
      );
      if (summary.title) productName = productName || summary.title;
      priceUsdCents = summary.priceUsdCents;
      imageUrl = summary.imageUrl;
      if (summary.productUrl) resolvedUrl = summary.productUrl;
      summaryMethod = "amazon_product";
    }
  } catch {
    /* variant lookup may still succeed */
  }

  const variantResult = await fetchProductVariants({
    productUrl: resolvedUrl,
    productName: productName || undefined,
    productSize: productSize ?? undefined,
    productColor: productColor ?? undefined,
  });

  if (variantResult.ok) {
    retailer = variantResult.retailer || retailer;
    const pick = pickVariantForContext(
      variantResult.variants,
      productSize,
      productColor,
    );

    if (pick) {
      productName = productName || pick.label;
      priceUsdCents = pick.priceUsdCents ?? priceUsdCents;
      imageUrl = pick.imageUrl ?? imageUrl;
      productSize = pick.size ?? productSize;
      productColor = pick.color ?? productColor;
      if (pick.productUrl) resolvedUrl = pick.productUrl;
    }

    const method = [summaryMethod, variantResult.method].filter(Boolean).join("+");
    const extraction = buildExtraction({
      productName: productName || null,
      retailer,
      priceUsdCents,
      imageUrl,
      productSize,
      productColor,
      method: method || "serpapi",
      variantLabel: pick?.label ?? null,
    });

    if (extractionHasUsefulData(extraction)) {
      return { ok: true, extraction, method: method || "serpapi" };
    }
  }

  if (productName || priceUsdCents || imageUrl) {
    const extraction = buildExtraction({
      productName: productName || null,
      retailer,
      priceUsdCents,
      imageUrl,
      productSize,
      productColor,
      method: summaryMethod || "serpapi_summary",
    });
    return { ok: true, extraction, method: summaryMethod || "serpapi_summary" };
  }

  return {
    ok: false,
    message:
      variantResult.ok === false
        ? variantResult.message
        : "SerpApi returned no product details for this URL.",
  };
}
