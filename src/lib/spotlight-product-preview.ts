import { fetchPageHtmlForAi } from "@/lib/ai/fetch-page-for-ai";
import {
  extractOgImageFromHtml,
  normalizeHttpsImageUrlForPage,
} from "@/lib/ai/product-image-url";
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

/** Best-effort preview image and title for a retailer product URL. */
export async function resolveSpotlightProductPageMeta(
  productUrl: string,
): Promise<SpotlightProductPageMeta> {
  const pageUrl = assertHttpsProductUrl(productUrl).href;
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
