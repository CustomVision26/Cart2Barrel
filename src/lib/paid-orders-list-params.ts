import { z } from "zod";

import { appendAdminListQueryToParams } from "@/lib/admin-customer-filter";
import type { AdminListQuery } from "@/lib/admin-customer-filter";

export const paidOrderLineSortValues = [
  "order_date_desc",
  "order_date_asc",
  "line_total_desc",
  "line_total_asc",
  "customer_az",
  "customer_za",
  "product_az",
  "product_za",
  "batch_az",
  "batch_za",
  "status_az",
  "status_za",
] as const;

export type PaidOrderLineSort = (typeof paidOrderLineSortValues)[number];

export const paidOrderLineSortEnum = z.enum(paidOrderLineSortValues);

export type PaidOrdersQueryInput = {
  q: string;
  page: number;
  ps: number;
  sort: PaidOrderLineSort;
};

/** @deprecated Use `PaidOrdersQueryInput` */
export type AdminOrdersQueryInput = PaidOrdersQueryInput;

/** @deprecated Use `PaidOrderLineSort` */
export type AdminOrderLineSort = PaidOrderLineSort;

/** @deprecated Use `paidOrderLineSortValues` */
export const adminOrderLineSortValues = paidOrderLineSortValues;

/** @deprecated Use `paidOrderLineSortEnum` */
export const adminOrderLineSortEnum = paidOrderLineSortEnum;

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  const k = Math.trunc(n);
  if (k < min || k > max) return fallback;
  return k;
}

/** Validates paid orders URL search params (pagination, sort, lookup). */
export function parsePaidOrdersQuery(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): PaidOrdersQueryInput {
  const sp = raw ?? {};
  const q = (first(sp.q) ?? "").trim().slice(0, 200);
  const pageParsed = Number.parseInt(String(first(sp.page) ?? "1"), 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;

  const psParsed = Number.parseInt(String(first(sp.ps) ?? "25"), 10);
  const ps = clampInt(psParsed, 10, 100, 25);

  const sortRaw = String(first(sp.sort) ?? "").trim();
  const sortParsed = paidOrderLineSortEnum.safeParse(sortRaw);
  const sort: PaidOrderLineSort =
    sortParsed.success ? sortParsed.data : "order_date_desc";

  return { q, page, ps, sort };
}

/** @deprecated Use `parsePaidOrdersQuery` */
export function parseAdminOrdersQuery(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): PaidOrdersQueryInput {
  return parsePaidOrdersQuery(raw);
}

type PaidOrdersListBasePath =
  | "/admin/orders"
  | "/admin/orders-history"
  | "/admin/packages"
  | "/admin/purchase-orders"
  | "/dashboard/orders"
  | "/dashboard/orders-history";

function buildHref(
  basePath: PaidOrdersListBasePath,
  opts: Partial<AdminListQuery>,
): string {
  const p = appendAdminListQueryToParams(new URLSearchParams(), opts);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function buildAdminOrdersListHref(
  opts: Partial<AdminListQuery> & {
    basePath?: "/admin/orders" | "/admin/orders-history";
  },
): string {
  return buildHref(opts.basePath ?? "/admin/orders", opts);
}

export function buildAdminPurchaseOrdersListHref(
  opts: Partial<AdminListQuery>,
): string {
  return buildHref("/admin/purchase-orders", opts);
}

export function buildAdminPackagesListHref(opts: Partial<AdminListQuery>): string {
  return buildHref("/admin/packages", opts);
}

export function buildDashboardOrdersListHref(opts: {
  q?: string;
  page?: number;
  ps?: number;
  sort?: PaidOrderLineSort;
  basePath?: "/dashboard/orders" | "/dashboard/orders-history";
}): string {
  return buildHref(opts.basePath ?? "/dashboard/orders", opts);
}
