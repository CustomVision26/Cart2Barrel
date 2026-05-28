import type { ProductVariantOffer } from "@/lib/product-variants/types";
import {
  parseSheinListingTitleFromUrl,
  sheinListingTitleTokens,
} from "@/lib/product-variants/shein-goods-id";

function appendShein(query: string): string {
  const t = query.trim();
  return t.toLowerCase().includes("shein") ? t : `${t} SHEIN`;
}

/** Best-effort Google Shopping query for a pasted SHEIN product URL. */
export function buildSheinSerpSearchQuery(opts: {
  productUrl: string;
  productName?: string | null;
  variants?: ProductVariantOffer[];
}): string {
  const fromName = opts.productName?.trim();
  if (fromName && fromName.length >= 8) {
    return appendShein(fromName);
  }

  const slugTitle = parseSheinListingTitleFromUrl(opts.productUrl);
  if (slugTitle && slugTitle.length >= 8) {
    return appendShein(slugTitle);
  }

  const primary = opts.variants?.find((v) => v.isCurrent) ?? opts.variants?.[0];
  const label = primary?.label?.trim();
  if (label && label.length >= 3) {
    const short = label.split("·")[0]?.trim() || label;
    if (sheinListingTitleTokens(short).length >= 2) {
      return appendShein(short);
    }
  }

  return "SHEIN product";
}

/** Ordered unique queries — URL slug first when the user has not typed a product name yet. */
export function buildSheinSerpSearchQueries(opts: {
  productUrl: string;
  productName?: string | null;
  variants?: ProductVariantOffer[];
}): string[] {
  const out: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t.length >= 8 && !out.includes(t)) out.push(t);
  };

  const slugTitle = parseSheinListingTitleFromUrl(opts.productUrl);
  if (slugTitle) push(appendShein(slugTitle));

  const fromName = opts.productName?.trim();
  if (fromName) push(appendShein(fromName));

  push(buildSheinSerpSearchQuery(opts));
  return out.slice(0, 4);
}

/** Shorter fallback query when the full URL slug is too long for Google Shopping. */
export function buildSheinShortSerpSearchQuery(productUrl: string): string | null {
  const slugTitle = parseSheinListingTitleFromUrl(productUrl);
  if (!slugTitle) return null;

  const skip = new Set([
    "outfit",
    "summer",
    "casual",
    "cute",
    "for",
    "baby",
    "girl",
    "newborn",
  ]);
  const core = sheinListingTitleTokens(slugTitle)
    .filter((t) => !skip.has(t) && t.length >= 4)
    .slice(0, 5);
  if (core.length < 2) return null;
  return appendShein(core.join(" "));
}

/** @deprecated Use {@link buildSheinSerpSearchQuery} with `productUrl`. */
export function buildSheinSerpImageSearchQuery(
  productName: string | null | undefined,
  variants: ProductVariantOffer[],
  productUrl?: string,
): string {
  return buildSheinSerpSearchQuery({
    productUrl: productUrl ?? "",
    productName,
    variants,
  });
}
