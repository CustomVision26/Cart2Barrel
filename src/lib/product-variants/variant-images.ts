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
  if (/^http:\/\//i.test(u)) u = `https://${u.slice("http://".length)}`;
  if (!/^https:\/\//i.test(u)) return null;

  u = u.replace(/\\+$/g, "").replace(/[)\]},;]+$/g, "");

  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

/**
 * Walmart/Target color chips are tiny thumbs (often odnHeight=30). They load as a
 * solid square and are not the product photo used on the listing preview.
 */
export function isLikelyColorSwatchImageUrl(
  raw: string | null | undefined,
): boolean {
  const u = normalizeRetailerImageUrl(raw);
  if (!u) return false;
  const lower = u.toLowerCase();
  if (/(?:^|[/?_=-])swatch(?:[/?_.-]|$)/.test(lower)) return true;
  if (lower.includes("colorchip") || lower.includes("color-chip")) return true;
  const sizes = [...u.matchAll(/odn(?:height|width)=(\d+)/gi)].map((m) =>
    Number(m[1]),
  );
  return sizes.some((n) => Number.isFinite(n) && n > 0 && n <= 80);
}

/** HTTPS product photo, excluding color-chip swatches. */
export function usableRetailerProductImageUrl(
  raw: string | null | undefined,
): string | null {
  const u = normalizeRetailerImageUrl(raw);
  if (!u || isLikelyColorSwatchImageUrl(u)) return null;
  return u;
}

/** Hero / listing image from SerpApi summary or the first variant row that has one. */
export function resolveListingImageUrl(
  variants: ProductVariantOffer[],
  explicit: string | null | undefined,
): string | null {
  const fromExplicit = usableRetailerProductImageUrl(explicit);
  if (fromExplicit) return fromExplicit;
  for (const row of variants) {
    const url = usableRetailerProductImageUrl(row.imageUrl);
    if (url) return url;
  }
  return null;
}

/** Fill missing per-variant images from the listing hero (common for immersive / page AI). */
export function fillMissingVariantImages(
  variants: ProductVariantOffer[],
  listingImageUrl: string | null,
): ProductVariantOffer[] {
  const fallback = usableRetailerProductImageUrl(listingImageUrl);
  if (!fallback) {
    return variants.map((row) => ({
      ...row,
      imageUrl: usableRetailerProductImageUrl(row.imageUrl),
    }));
  }

  return variants.map((row) => ({
    ...row,
    imageUrl: usableRetailerProductImageUrl(row.imageUrl) ?? fallback,
  }));
}

/** Per-variant image for the request form, with listing hero fallback. */
export function resolveVariantDraftImageUrl(
  variant: Pick<ProductVariantOffer, "imageUrl">,
  listingImageUrl?: string | null,
): string | null {
  return (
    usableRetailerProductImageUrl(variant.imageUrl) ??
    usableRetailerProductImageUrl(listingImageUrl)
  );
}

/**
 * Image to copy into the request form when applying a variant.
 * The variant thumbnail wins; scraped listing/hero images are fallback only.
 */
export function resolveAppliedVariantImageUrl(
  variant: Pick<ProductVariantOffer, "imageUrl">,
  listingImageUrl?: string | null,
  scrapedListingImageUrl?: string | null,
): string | null {
  return (
    usableRetailerProductImageUrl(variant.imageUrl) ??
    usableRetailerProductImageUrl(scrapedListingImageUrl) ??
    usableRetailerProductImageUrl(listingImageUrl)
  );
}
