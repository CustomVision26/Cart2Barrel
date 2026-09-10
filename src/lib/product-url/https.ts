/** Coerce retailer/page URLs to https so Zod save payloads accept SerpApi http links. */
export function normalizeHttpsUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  let u = raw.trim().replace(/['"`]+$/g, "");
  if (!u) return undefined;
  if (u.startsWith("//")) u = `https:${u}`;
  if (/^http:\/\//i.test(u)) u = `https://${u.slice("http://".length)}`;
  if (!/^https:\/\//i.test(u)) return undefined;
  try {
    const href = new URL(u).href;
    return href.length <= 2048 ? href : undefined;
  } catch {
    return undefined;
  }
}

export const SPOTLIGHT_LABEL_MAX = 500;

/** Walmart/Amazon titles often exceed the old 200-char save cap. */
export function clipSpotlightLabel(
  raw: string | null | undefined,
  max = SPOTLIGHT_LABEL_MAX,
): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
