import type { ProductVariantOffer } from "@/lib/product-variants/types";

/** Normalize retailer CDN URLs from JSON/HTML (protocol-relative, escapes, trailing junk). */
export function normalizeRetailerImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  let u = raw
    .trim()
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https:\/\//i.test(u)) return null;

  u = u.replace(/\\+$/g, "").replace(/[)\]},;]+$/g, "");

  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

function isHttpsImageUrl(url: string | null | undefined): url is string {
  return normalizeRetailerImageUrl(url) != null;
}

/** Hero / listing image from SerpApi summary or the first variant row that has one. */
export function resolveListingImageUrl(
  variants: ProductVariantOffer[],
  explicit: string | null | undefined,
): string | null {
  const fromExplicit = normalizeRetailerImageUrl(explicit);
  if (fromExplicit) return fromExplicit;
  for (const row of variants) {
    const url = normalizeRetailerImageUrl(row.imageUrl);
    if (url) return url;
  }
  return null;
}

/** Fill missing per-variant images from the listing hero (common for immersive / page AI). */
export function fillMissingVariantImages(
  variants: ProductVariantOffer[],
  listingImageUrl: string | null,
): ProductVariantOffer[] {
  const fallback = normalizeRetailerImageUrl(listingImageUrl);
  if (!fallback) {
    return variants.map((row) => ({
      ...row,
      imageUrl: normalizeRetailerImageUrl(row.imageUrl),
    }));
  }

  return variants.map((row) => ({
    ...row,
    imageUrl: normalizeRetailerImageUrl(row.imageUrl) ?? fallback,
  }));
}

/** Per-variant image for the request form, with listing hero fallback. */
export function resolveVariantDraftImageUrl(
  variant: Pick<ProductVariantOffer, "imageUrl">,
  listingImageUrl?: string | null,
): string | null {
  return (
    normalizeRetailerImageUrl(variant.imageUrl) ??
    normalizeRetailerImageUrl(listingImageUrl)
  );
}
