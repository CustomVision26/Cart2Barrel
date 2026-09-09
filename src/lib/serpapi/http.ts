import { getSerpApiKey } from "@/lib/serpapi/env";

const CACHE_TTL_MS = 10 * 60 * 1000;

export const SERPAPI_RATE_LIMIT_MESSAGE =
  "SerpApi rate-limited this API key (HTTP 429). Every customer product lookup, quote estimate, and admin Spotlight search shares one key. Several people can use it at once; 429 means the plan’s request rate was exceeded for a moment. Try the same lookup again.";

function cacheKey(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

const responseCache = new Map<
  string,
  { expires: number; data: Record<string, unknown> }
>();
const inflight = new Map<string, Promise<Record<string, unknown>>>();

export function isSerpApiRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /HTTP 429|rate limit|too many requests/i.test(msg);
}

export async function serpApiGet<T extends Record<string, unknown>>(
  params: Record<string, string>,
): Promise<T> {
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not configured.");
  }

  const key = cacheKey(params);
  const cached = responseCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = (async () => {
    const url = new URL("https://serpapi.com/search.json");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), {
      method: "GET",
      next: { revalidate: 0 },
    });

    if (res.status === 429) {
      throw new Error(SERPAPI_RATE_LIMIT_MESSAGE);
    }

    if (!res.ok) {
      throw new Error(`SerpApi request failed (HTTP ${res.status}).`);
    }

    const data = (await res.json()) as T & { error?: string };
    if (data.error) {
      if (isSerpApiRateLimitError(data.error)) {
        throw new Error(SERPAPI_RATE_LIMIT_MESSAGE);
      }
      throw new Error(data.error);
    }

    responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
    return data;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, pending);
  return pending as Promise<T>;
}
