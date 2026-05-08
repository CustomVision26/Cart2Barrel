/**
 * Resolve a product image URL to absolute https for safe display.
 */
export function normalizeHttpsImageUrlForPage(
  raw: string | null | undefined,
  pageUrl: string
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const u = new URL(t, pageUrl);
    if (u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * Best-effort primary image from social / SEO meta tags in raw HTML.
 */
export function extractOgImageFromHtml(
  html: string,
  pageUrl: string
): string | null {
  const patterns: RegExp[] = [
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
    /<meta\s+name=["']twitter:image:src["']\s+content=["']([^"']+)["']/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const decoded = decodeBasicHtmlEntities(m[1].trim());
      const abs = normalizeHttpsImageUrlForPage(decoded, pageUrl);
      if (abs) return abs;
    }
  }

  return null;
}
