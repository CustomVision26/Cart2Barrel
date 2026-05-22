import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import { normalizeSpotlightProductUrlInput } from "@/lib/spotlight-product-preview";
import { hostnameFromProductUrl } from "@/lib/site-name";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Serializable spotlight row passed into the AI-assisted request workspace. */
export type SpotlightRequestPrefill = PublicSpotlightProduct;

/** Strip quotes/whitespace from deep-link query params (e.g. malformed `id="'`). */
export function sanitizeSpotlightUuidQueryParam(
  raw: string | undefined,
): string | undefined {
  const t = raw?.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!t || !UUID_RE.test(t)) return undefined;
  return t;
}

export function isSpotlightUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function looseProductUrl(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function spotlightPrefillProductName(
  product: SpotlightRequestPrefill,
): string {
  const label = product.label?.trim();
  if (label) return label;
  const size = product.productSize?.trim();
  const color = product.productColor?.trim();
  if (size && color) return `${color} · ${size}`;
  if (size || color) return size ?? color ?? "";
  return hostnameFromProductUrl(product.productUrl) ?? "Product";
}

/** Initial item-request form values from a spotlight row (server or client). */
export function spotlightFormSeedFromPrefill(
  prefill: SpotlightRequestPrefill,
  quantity = 1,
): {
  productUrl: string;
  productName: string;
  productSize: string;
  productColor: string;
  draftSiteName: string;
  draftProductImageUrl: string | null;
  aiMerchPreview: ReturnType<typeof spotlightPrefillMerchPreview>;
} {
  const productUrl =
    normalizeSpotlightProductUrlInput(prefill.productUrl) ??
    looseProductUrl(prefill.productUrl);
  return {
    productUrl,
    productName: spotlightPrefillProductName(prefill),
    productSize: prefill.productSize?.trim() ?? "",
    productColor: prefill.productColor?.trim() ?? "",
    draftSiteName: spotlightPrefillSiteName(prefill),
    draftProductImageUrl: prefill.imageUrl?.trim() || null,
    aiMerchPreview: spotlightPrefillMerchPreview(prefill, quantity),
  };
}

export function spotlightPrefillSiteName(product: SpotlightRequestPrefill): string {
  return hostnameFromProductUrl(product.productUrl) ?? "Retailer";
}

/** Merchandise preview block when spotlight includes a curated price. */
export function spotlightPrefillMerchPreview(
  product: SpotlightRequestPrefill,
  quantity: number,
): {
  quantity: number;
  unitPriceCents: number;
  merchandiseSubtotalCents: number;
  variantSizeNorm: string;
  variantColorNorm: string;
} | null {
  const cents = product.priceUsdCents;
  if (cents == null || cents <= 0) return null;
  const size = product.productSize?.trim() ?? "";
  const color = product.productColor?.trim() ?? "";
  return {
    quantity,
    unitPriceCents: cents,
    merchandiseSubtotalCents: cents * quantity,
    variantSizeNorm: size.toLowerCase(),
    variantColorNorm: color.toLowerCase(),
  };
}
