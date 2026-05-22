import { getSerpApiKey } from "@/lib/serpapi/env";

export async function serpApiGet<T extends Record<string, unknown>>(
  params: Record<string, string>,
): Promise<T> {
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not configured.");
  }

  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`SerpApi request failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as T & { error?: string };
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}
