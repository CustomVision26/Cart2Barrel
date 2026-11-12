import { serpApiGet } from "@/lib/serpapi/http";
import type { WalmartSearchHit } from "@/lib/budget-barrel/normalize";

type WalmartSearchResponse = {
  organic_results?: WalmartSearchHit[];
};

/**
 * Walmart Search (`engine=walmart`). This engine has no fulfillment-location
 * parameter; Google Shopping receives the hub location separately.
 */
export async function searchWalmartProducts(
  query: string,
  opts?: { maxResults?: number },
): Promise<WalmartSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const data = await serpApiGet<WalmartSearchResponse>({
    engine: "walmart",
    query: q,
    device: "desktop",
  });

  return (data.organic_results ?? []).slice(0, opts?.maxResults ?? 8);
}
