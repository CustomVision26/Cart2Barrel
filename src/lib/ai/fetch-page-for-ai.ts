import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

const MAX_REDIRECTS = 8;
const MAX_BYTES = 180_000;
const FETCH_TIMEOUT_MS = 18_000;

const RETAILER_BLOCKED_STATUSES = new Set([401, 403, 429, 451, 503]);

export const RETAILER_PAGE_REDIRECT_USER_MESSAGE =
  "This retailer redirected the lookup (geo, cookies, or bot check). Name, price, and image can still fill from Google Shopping when SerpApi finds the listing; otherwise open the product page and enter them yourself.";

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

export function isRetailerPageFetchRedirectMessage(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("too many redirects") ||
    low.includes("missing location header") ||
    low.includes("redirected the lookup")
  );
}

export function isRetailerPageFetchBlockedMessage(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("http 403") ||
    low.includes("http 401") ||
    low.includes("http 429") ||
    low.includes("blocked automated access") ||
    isRetailerPageFetchRedirectMessage(message)
  );
}

export function retailerPageFetchBlockedUserMessage(status?: number): string {
  const code = status != null && status > 0 ? ` (HTTP ${status})` : "";
  return `This retailer blocked automated page access${code}. Use Enter quote manually below, or open the product URL in your browser and fill in name, price, and image yourself.`;
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || null;
}

function resolveRedirectTarget(current: URL, res: Response): URL | null {
  const loc = firstHeaderValue(res.headers.get("location"));
  if (loc) {
    try {
      return new URL(loc, current);
    } catch {
      return null;
    }
  }
  const refresh = res.headers.get("refresh");
  const refreshMatch = refresh?.match(/url\s*=\s*['"]?([^;'"]+)/i);
  if (refreshMatch?.[1]) {
    try {
      return new URL(refreshMatch[1].trim(), current);
    } catch {
      return null;
    }
  }
  return null;
}

function parseMetaRefreshUrl(html: string, current: URL): URL | null {
  const patterns = [
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url\s*=\s*([^"'>\s]+)/i,
    /<meta[^>]+content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]+http-equiv=["']refresh["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    try {
      return new URL(m[1].replace(/&amp;/gi, "&").trim(), current);
    } catch {
      continue;
    }
  }
  return null;
}

async function readResponseBody(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

export class RetailerPageBlockedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(retailerPageFetchBlockedUserMessage(status));
    this.name = "RetailerPageBlockedError";
    this.status = status;
  }
}

export class RetailerPageRedirectError extends Error {
  constructor() {
    super(RETAILER_PAGE_REDIRECT_USER_MESSAGE);
    this.name = "RetailerPageRedirectError";
  }
}

export function isRetailerPageAccessError(
  err: unknown,
): err is RetailerPageBlockedError | RetailerPageRedirectError {
  return (
    err instanceof RetailerPageBlockedError ||
    err instanceof RetailerPageRedirectError
  );
}

/** Hosts that return 307 with no Location (Fastly / geo walls) — skip HTML scrape. */
export function hostnameLikelyBlocksHtmlFetch(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return h.includes("bathandbodyworks");
}

async function fetchDirectHtml(
  productUrl: string,
  signal: AbortSignal,
): Promise<string> {
  let url = assertHttpsProductUrl(productUrl);
  const seen = new Set<string>();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const href = url.toString();
    if (seen.has(href)) {
      throw new RetailerPageRedirectError();
    }
    seen.add(href);
    assertHttpsProductUrl(href);

    const res = await fetch(href, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        ...BROWSER_FETCH_HEADERS,
        Referer: `${url.origin}/`,
      },
    });

    if (res.status >= 300 && res.status < 400) {
      let next = resolveRedirectTarget(url, res);
      if (!next) {
        try {
          const body = await readResponseBody(res);
          next = parseMetaRefreshUrl(body, url);
        } catch {
          next = null;
        }
      }
      if (!next || hop === MAX_REDIRECTS) {
        throw new RetailerPageRedirectError();
      }
      try {
        url = assertHttpsProductUrl(next.toString());
      } catch {
        throw new RetailerPageRedirectError();
      }
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
  throw new RetailerPageRedirectError();
}

/** Optional Jina Reader proxy when direct fetch is blocked (set JINA_READER_API_KEY for higher limits). */
async function fetchViaJinaReader(
  productUrl: string,
  signal: AbortSignal,
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

/**
 * Fetch a public product page over HTTPS with redirect and size limits.
 * Falls back to Jina Reader when the retailer returns 401/403/429 — not on
 * Fastly 307-with-no-Location, which the reader also cannot open.
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
