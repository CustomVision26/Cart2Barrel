import { getSerpApiKey } from "@/lib/serpapi/env";

export type SerpApiAccountSnapshot = {
  planName: string | null;
  searchesPerMonth: number | null;
  thisMonthUsage: number | null;
  planSearchesLeft: number | null;
  thisHourSearches: number | null;
  lastHourSearches: number | null;
  hourlyLimit: number | null;
  planRenewalDate: string | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Plan meters from SerpApi Account API (does not consume search credits).
 * @see https://serpapi.com/account-api
 */
export async function fetchSerpApiAccountSnapshot(): Promise<SerpApiAccountSnapshot | null> {
  const apiKey = getSerpApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL("https://serpapi.com/account.json");
    url.searchParams.set("api_key", apiKey);
    const res = await fetch(url.toString(), {
      method: "GET",
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const renewal = data.plan_renewal_date;
    return {
      planName: typeof data.plan_name === "string" ? data.plan_name : null,
      searchesPerMonth: asFiniteNumber(data.searches_per_month),
      thisMonthUsage: asFiniteNumber(data.this_month_usage),
      planSearchesLeft: asFiniteNumber(data.plan_searches_left),
      thisHourSearches: asFiniteNumber(data.this_hour_searches),
      lastHourSearches: asFiniteNumber(data.last_hour_searches),
      hourlyLimit: asFiniteNumber(data.account_rate_limit_per_hour),
      planRenewalDate: typeof renewal === "string" ? renewal : null,
    };
  } catch {
    return null;
  }
}
