/** Max product URLs attached to a single support message. */
export const SUPPORT_TICKET_PRODUCT_LINKS_MAX = 5;

export function normalizeSupportTicketProductLinks(
  urls: string[] | null | undefined,
): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url || seen.has(url)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    } catch {
      continue;
    }
    seen.add(url);
    out.push(url);
    if (out.length >= SUPPORT_TICKET_PRODUCT_LINKS_MAX) break;
  }
  return out;
}
