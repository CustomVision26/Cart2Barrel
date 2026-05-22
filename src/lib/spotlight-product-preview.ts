import { fetchPageHtmlForAi } from "@/lib/ai/fetch-page-for-ai";
import {
  extractOgImageFromHtml,
  normalizeHttpsImageUrlForPage,
} from "@/lib/ai/product-image-url";
import { parseProductUrl } from "@/lib/product-url/retailer-id";
import { fetchAmazonProductSummary } from "@/lib/serpapi/amazon-product";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { fetchWalmartProductSummary } from "@/lib/serpapi/walmart-product";
import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Best-effort product title from og:title or document title. */
export function extractPageTitleFromHtml(html: string): string | null {
  const patterns: RegExp[] = [
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const raw = m?.[1]?.trim();
    if (!raw) continue;
    const decoded = decodeBasicHtmlEntities(raw).replace(/\s+/g, " ").trim();
    if (decoded.length >= 2) return decoded;
  }
  return null;
}

export type SpotlightProductPageMeta = {
  imageUrl: string | null;
  title: string | null;
};

/** SerpApi retailer APIs (same path as variant import) — works when HTML scrape is blocked. */
async function resolveSpotlightMetaFromSerpApi(
  productUrl: string,
): Promise<SpotlightProductPageMeta | null> {
  if (!getSerpApiKey()) return null;

  const parsed = parseProductUrl(productUrl);
  if (!parsed) return null;

  try {
    if (parsed.kind === "walmart" && parsed.walmartProductId) {
      const summary = await fetchWalmartProductSummary(parsed.walmartProductId);
      return {
        imageUrl: summary.imageUrl,
        title: summary.title,
      };
    }
    if (parsed.kind === "amazon" && parsed.amazonAsin) {
      const summary = await fetchAmazonProductSummary(
        parsed.amazonAsin,
        parsed.amazonDomain,
      );
      return {
        imageUrl: summary.imageUrl,
        title: summary.title,
      };
    }
  } catch {
    return null;
  }

  return null;
}

/** Best-effort preview image and title for a retailer product URL. */
export async function resolveSpotlightProductPageMeta(
  productUrl: string,
): Promise<SpotlightProductPageMeta> {
  const pageUrl = assertHttpsProductUrl(productUrl).href;

  const fromSerp = await resolveSpotlightMetaFromSerpApi(pageUrl);
  if (fromSerp?.imageUrl || fromSerp?.title) {
    if (fromSerp.imageUrl && fromSerp.title) {
      return fromSerp;
    }
    try {
      const html = await fetchPageHtmlForAi(pageUrl);
      return {
        imageUrl:
          fromSerp.imageUrl ?? extractOgImageFromHtml(html, pageUrl),
        title: fromSerp.title ?? extractPageTitleFromHtml(html),
      };
    } catch {
      return {
        imageUrl: fromSerp.imageUrl,
        title: fromSerp.title,
      };
    }
  }

  try {
    const html = await fetchPageHtmlForAi(pageUrl);
    return {
      imageUrl: extractOgImageFromHtml(html, pageUrl),
      title: extractPageTitleFromHtml(html),
    };
  } catch {
    return { imageUrl: null, title: null };
  }
}

/**
 * Best-effort preview image for a retailer product URL (og:image / twitter:image).
 */
export async function resolveSpotlightProductPreviewImage(
  productUrl: string,
): Promise<string | null> {
  const meta = await resolveSpotlightProductPageMeta(productUrl);
  return meta.imageUrl;
}

export function normalizeSpotlightProductUrlInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = assertHttpsProductUrl(withScheme);
    return u.href;
  } catch {
    return null;
  }
}

export function safeHttpsImageUrl(
  raw: string | null | undefined,
  pageUrl: string,
): string | null {
  return normalizeHttpsImageUrlForPage(raw, pageUrl);
}
