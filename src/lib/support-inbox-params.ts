import { z } from "zod";

import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export const supportInboxFilterValues = [
  "all",
  "unread",
  "read",
  "awaiting_customer",
  "awaiting_staff",
  "open",
  "resolved",
  "closed",
] as const;

export type SupportInboxFilter = (typeof supportInboxFilterValues)[number];

export type SupportInboxQueryInput = {
  q: string;
  page: number;
  ps: number;
  filter: SupportInboxFilter;
};

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  const k = Math.trunc(n);
  if (k < min || k > max) return fallback;
  return k;
}

export function parseSupportInboxQuery(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): SupportInboxQueryInput {
  const sp = raw ?? {};
  const q = (first(sp.q) ?? "").trim().slice(0, 200);
  const pageParsed = Number.parseInt(String(first(sp.page) ?? "1"), 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
  const psParsed = Number.parseInt(String(first(sp.ps) ?? "10"), 10);
  const ps = clampInt(psParsed, 5, 50, 10);
  const filterRaw = String(first(sp.filter) ?? "all").trim();
  const filterParsed = z.enum(supportInboxFilterValues).safeParse(filterRaw);
  const filter: SupportInboxFilter =
    filterParsed.success ? filterParsed.data : "all";
  return { q, page, ps, filter };
}

export function buildSupportInboxHref(
  mode: "inbox" | "history",
  query: Partial<SupportInboxQueryInput>,
): string {
  const base =
    mode === "history" ?
      DASHBOARD_SUPPORT_ROUTES.history
    : DASHBOARD_SUPPORT_ROUTES.inbox;
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.ps && query.ps !== 10) params.set("ps", String(query.ps));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
