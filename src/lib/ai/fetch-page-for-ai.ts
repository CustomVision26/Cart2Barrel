import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 180_000;
const FETCH_TIMEOUT_MS = 18_000;

const RETAILER_BLOCKED_STATUSES = new Set([401, 403, 429, 451, 503]);

/** Browser-like headers — many retailers block obvious bot user-agents. */
const BROWSER_FETCH_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

function contentTypeOk(ct: string | null): boolean {
  if (!ct) return true;
  const low = ct.toLowerCase();
  return (
    low.includes("text/html") ||
    low.includes("text/plain") ||
    low.includes("application/xhtml+xml") ||
    low.includes("text/markdown")
  );
}

function isRetailerBlockedStatus(status: number): boolean {
  return RETAILER_BLOCKED_STATUSES.has(status);
}

export function isRetailerPageFetchBlockedMessage(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("http 403") ||
    low.includes("http 401") ||
    low.includes("http 429") ||
    low.includes("blocked automated access")
  );
}

export function retailerPageFetchBlockedUserMessage(status?: number): string {
  const code = status != null ? ` (HTTP ${status})` : "";
  return `This retailer blocked automated page access${code}. Use Enter quote manually below, or open the product URL in your browser and fill in name, price, and image yourself.`;
}

async function readResponseBody(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

async function fetchDirectHtml(
  productUrl: string,
  signal: AbortSignal
): Promise<string> {
  let url = assertHttpsProductUrl(productUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertHttpsProductUrl(url.toString());

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal,
      headers: BROWSER_FETCH_HEADERS,
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
      if (isRetailerBlockedStatus(res.status)) {
        throw new RetailerPageBlockedError(res.status);
      }
      throw new Error(`Page returned HTTP ${res.status}.`);
    }
    if (!contentTypeOk(res.headers.get("content-type"))) {
      throw new Error("Unsupported content type for extraction.");
    }

    return readResponseBody(res);
  }
  throw new Error("Too many redirects.");
}

/** Optional Jina Reader proxy when direct fetch is blocked (set JINA_READER_API_KEY for higher limits). */
async function fetchViaJinaReader(
  productUrl: string,
  signal: AbortSignal
): Promise<string> {
  const target = assertHttpsProductUrl(productUrl).toString();
  const readerUrl = `https://r.jina.ai/${target}`;
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,text/plain,*/*",
    "X-Respond-With": "html",
  };
  const apiKey = process.env.JINA_READER_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(readerUrl, {
    method: "GET",
    signal,
    headers,
  });

  if (!res.ok) {
    throw new Error(`Reader proxy returned HTTP ${res.status}.`);
  }
  if (!contentTypeOk(res.headers.get("content-type"))) {
    throw new Error("Unsupported content type from reader proxy.");
  }

  return readResponseBody(res);
}

export class RetailerPageBlockedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(retailerPageFetchBlockedUserMessage(status));
    this.name = "RetailerPageBlockedError";
    this.status = status;
  }
}

/**
 * Fetch a public product page over HTTPS with redirect and size limits.
 * Falls back to Jina Reader when the retailer blocks the server fetch.
 */
export async function fetchPageHtmlForAi(productUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    try {
      return await fetchDirectHtml(productUrl, controller.signal);
    } catch (e) {
      if (!(e instanceof RetailerPageBlockedError)) {
        throw e;
      }
      try {
        return await fetchViaJinaReader(productUrl, controller.signal);
      } catch {
        throw e;
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
