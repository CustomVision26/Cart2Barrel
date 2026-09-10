import { getSerpApiKey } from "@/lib/serpapi/env";
import { getSerpApiUsageContext } from "@/lib/serpapi/usage-context";
import { recordSerpApiSearchEvent } from "@/data/serp-api-search-events";

const CACHE_TTL_MS = 10 * 60 * 1000;

export const SERPAPI_QUOTA_EXHAUSTED_MESSAGE =
  "SerpApi monthly searches are used up for this API key. Customer quote lookups, admin estimates, and Spotlight all share the same plan. Upgrade at serpapi.com/change-plan, or wait until the billing period resets.";

export const SERPAPI_THROUGHPUT_MESSAGE =
  "SerpApi hit this plan’s hourly request limit (HTTP 429). Several customers and admins can search at once; try the same lookup again in a little while.";

/** @deprecated Use quota or throughput messages; kept for existing 429 checks. */
export const SERPAPI_RATE_LIMIT_MESSAGE = SERPAPI_QUOTA_EXHAUSTED_MESSAGE;

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
  return /HTTP 429|rate limit|too many requests|run out of searches|monthly searches are used up|hourly request limit/i.test(
    msg,
  );
}

function messageFor429(bodyError?: string): string {
  if (bodyError && /run out of searches|out of searches|no searches remaining/i.test(bodyError)) {
    return SERPAPI_QUOTA_EXHAUSTED_MESSAGE;
  }
  return SERPAPI_THROUGHPUT_MESSAGE;
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
      let bodyError: string | undefined;
      try {
        const payload = (await res.json()) as { error?: string };
        bodyError = payload.error;
      } catch {
        /* body may be empty */
      }
      throw new Error(messageFor429(bodyError));
    }

    if (!res.ok) {
      throw new Error(`SerpApi request failed (HTTP ${res.status}).`);
    }

    const data = (await res.json()) as T & { error?: string };
    if (data.error) {
      if (/run out of searches|out of searches/i.test(data.error)) {
        throw new Error(SERPAPI_QUOTA_EXHAUSTED_MESSAGE);
      }
      if (isSerpApiRateLimitError(data.error)) {
        throw new Error(messageFor429(data.error));
      }
      throw new Error(data.error);
    }

    responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
    const ctx = getSerpApiUsageContext();
    void recordSerpApiSearchEvent({
      clerkUserId: ctx?.userId ?? null,
      source: ctx?.source ?? "other",
      engine: params.engine?.trim() || null,
    });
    return data;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, pending);
  return pending as Promise<T>;
}
