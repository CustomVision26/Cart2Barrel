import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

/** Normalize a pasted retailer URL for forms and spotlight deep links. Safe on client. */
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
