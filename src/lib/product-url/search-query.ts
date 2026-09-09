import { retailerLabelFromProductUrl } from "@/lib/site-name";

const SKIP_PATH_SEGMENTS =
  /^(dp|gp|product|aw|d|offer-listing|stores|page|s|shop|ip|itm|item|search|browse|brand|category|products|cp)$/i;

function pathSegmentTitle(raw: string): string | null {
  const seg = raw.replace(/\.(html|htm|jsp|aspx)$/i, "").replace(/:+$/g, "");
  if (!seg || seg.length < 4) return null;
  if (SKIP_PATH_SEGMENTS.test(seg)) return null;
  if (/^prd-\d+$/i.test(seg)) return null;
  if (/^a-\d{6,}$/i.test(seg)) return null;
  if (/^b0[a-z0-9]{8}$/i.test(seg)) return null;
  if (/^[a-z0-9]{8,12}$/i.test(seg) && /\d/.test(seg)) return null;
  if (/^\d+$/.test(seg)) return null;
  const title = seg.replace(/-/g, " ").trim();
  return title.length >= 4 ? title : null;
}

/** Human-readable product title guess from URL path (e.g. Amazon / Kohl's slugs). */
export function titleHintFromProductUrl(productUrl: string): string | null {
  try {
    const url = new URL(productUrl.trim());
    const candidates = url.pathname
      .split("/")
      .filter(Boolean)
      .map(pathSegmentTitle)
      .filter((s): s is string => Boolean(s));

    const hyphenated = candidates.find((c) => c.includes(" "));
    return hyphenated ?? candidates[0] ?? null;
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
