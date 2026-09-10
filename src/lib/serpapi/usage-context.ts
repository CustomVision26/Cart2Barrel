import { cache } from "react";

export const SERP_API_SEARCH_SOURCES = [
  "customer_quote",
  "admin_estimate",
  "admin_spotlight",
  "retailer_check",
  "other",
] as const;

export type SerpApiSearchSource = (typeof SERP_API_SEARCH_SOURCES)[number];

export type SerpApiUsageContext = {
  userId: string | null;
  source: SerpApiSearchSource;
};

type Holder = { current: SerpApiUsageContext | undefined };

const usageHolder = cache((): Holder => ({ current: undefined }));

export function withSerpApiUsage<T>(
  ctx: SerpApiUsageContext,
  fn: () => Promise<T>,
): Promise<T> {
  const holder = usageHolder();
  const previous = holder.current;
  holder.current = ctx;
  return fn().finally(() => {
    holder.current = previous;
  });
}

export function getSerpApiUsageContext(): SerpApiUsageContext | undefined {
  return usageHolder().current;
}
