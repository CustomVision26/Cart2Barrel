import { z } from "zod";

export const SHIPPING_HISTORY_SORT_VALUES = [
  "shipped_desc",
  "shipped_asc",
  "name_az",
  "name_za",
  "status_az",
  "freight_az",
  "customer_az",
  "customer_za",
] as const;

export type ShippingHistorySort = (typeof SHIPPING_HISTORY_SORT_VALUES)[number];

export const shippingHistorySortEnum = z.enum(SHIPPING_HISTORY_SORT_VALUES);

export const SHIPPING_HISTORY_PAGE_SIZES = [10, 25, 50] as const;

export type ShippingHistoryQuery = {
  q: string;
  page: number;
  ps: number;
  sort: ShippingHistorySort;
};

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export function parseShippingHistoryQuery(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): ShippingHistoryQuery {
  const sp = raw ?? {};
  const q = (first(sp.q) ?? "").trim().slice(0, 200);
  const pageParsed = Number.parseInt(String(first(sp.page) ?? "1"), 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
  const psParsed = Number.parseInt(String(first(sp.ps) ?? "10"), 10);
  const ps = (SHIPPING_HISTORY_PAGE_SIZES as readonly number[]).includes(psParsed)
    ? psParsed
    : 10;
  const sortRaw = String(first(sp.sort) ?? "").trim();
  const sortParsed = shippingHistorySortEnum.safeParse(sortRaw);
  const sort: ShippingHistorySort = sortParsed.success
    ? sortParsed.data
    : "shipped_desc";
  return { q, page, ps, sort };
}

export function buildShippingHistoryHref(
  opts: Partial<ShippingHistoryQuery> & {
    basePath?: string;
    userId?: string;
  },
): string {
  const basePath = opts.basePath ?? "/dashboard/shipping/history";
  const p = new URLSearchParams();
  const q = opts.q?.trim();
  if (q) p.set("q", q);
  if (opts.sort && opts.sort !== "shipped_desc") p.set("sort", opts.sort);
  if (opts.ps && opts.ps !== 10) p.set("ps", String(opts.ps));
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  if (opts.userId?.trim()) p.set("userId", opts.userId.trim());
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
