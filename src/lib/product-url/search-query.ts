import { retailerLabelFromProductUrl } from "@/lib/site-name";

/** Human-readable product title guess from URL path (e.g. Kohl's slug segments). */
export function titleHintFromProductUrl(productUrl: string): string | null {
  try {
    const url = new URL(productUrl.trim());
    const segments = url.pathname.split("/").filter(Boolean);

    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]!
        .replace(/\.(html|htm|jsp|aspx)$/i, "")
        .replace(/:+$/g, "");
      if (!seg || seg.length < 4) continue;
      if (/^prd-\d+$/i.test(seg)) continue;
      if (/^[a-z0-9]{8,12}$/i.test(seg) && /\d/.test(seg)) continue;
      if (/^\d+$/.test(seg)) continue;
      return seg.replace(/-/g, " ").trim();
    }
  } catch {
    /* invalid URL */
  }
  return null;
}

/** Shopping / immersive search string for variant lookup. */
export function buildVariantSearchQuery(input: {
  productUrl: string;
  productName?: string;
  productSize?: string;
  productColor?: string;
}): string {
  const urlHint = titleHintFromProductUrl(input.productUrl);
  const retailer = retailerLabelFromProductUrl(input.productUrl);

  return [
    input.productName?.trim(),
    input.productSize?.trim(),
    input.productColor?.trim(),
    urlHint,
    retailer !== "Retailer" ? retailer : null,
  ]
    .filter(Boolean)
    .join(" ");
}
