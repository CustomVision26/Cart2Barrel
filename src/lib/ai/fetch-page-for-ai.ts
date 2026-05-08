import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 180_000;
const FETCH_TIMEOUT_MS = 18_000;

function contentTypeOk(ct: string | null): boolean {
  if (!ct) return true;
  const low = ct.toLowerCase();
  return (
    low.includes("text/html") ||
    low.includes("text/plain") ||
    low.includes("application/xhtml+xml")
  );
}

/**
 * Fetch a public product page over HTTPS with redirect and size limits.
 */
export async function fetchPageHtmlForAi(productUrl: string): Promise<string> {
  let url = assertHttpsProductUrl(productUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertHttpsProductUrl(url.toString());

      const res = await fetch(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Cart2BarrelQuoteBot/1.0 (+https://cart2barrel)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === MAX_REDIRECTS) {
          throw new Error("Too many redirects or missing Location header.");
        }
        url = new URL(loc, url);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Page returned HTTP ${res.status}.`);
      }
      if (!contentTypeOk(res.headers.get("content-type"))) {
        throw new Error("Unsupported content type for extraction.");
      }

      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
      const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
      return text;
    }
    throw new Error("Too many redirects.");
  } finally {
    clearTimeout(timer);
  }
}
