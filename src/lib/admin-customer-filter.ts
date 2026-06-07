import { z } from "zod";

import type { AdminQuoteHistoryGroup } from "@/data/admin-quote-history";
import type {
  AdminBatchHistoryBundle,
  AdminBatchHistoryOwnerBundle,
  AdminSubmittedBatchBundle,
} from "@/data/batch-quote-sessions";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import type { PaidOrdersQueryInput } from "@/lib/paid-orders-list-params";
import { parsePaidOrdersQuery } from "@/lib/paid-orders-list-params";

/** URL search param for the global admin customer scope filter. */
export const ADMIN_CUSTOMER_FILTER_PARAM = "userId";

const clerkUserIdSchema = z.string().min(1).max(128);

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export type AdminListQuery = PaidOrdersQueryInput & {
  userId?: string;
};

export type AdminCustomerFilter = {
  clerkUserId?: string;
};

/** Parses list query params plus optional global `userId` customer filter. */
export function parseAdminListQuery(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): AdminListQuery {
  const base = parsePaidOrdersQuery(raw);
  const userIdRaw = (first(raw?.[ADMIN_CUSTOMER_FILTER_PARAM]) ?? "").trim();
  if (!userIdRaw) {
    return base;
  }
  const parsed = clerkUserIdSchema.safeParse(userIdRaw);
  return parsed.success ? { ...base, userId: parsed.data } : base;
}

export function parseAdminCustomerFilter(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): AdminCustomerFilter {
  const userIdRaw = (first(raw?.[ADMIN_CUSTOMER_FILTER_PARAM]) ?? "").trim();
  if (!userIdRaw) {
    return {};
  }
  const parsed = clerkUserIdSchema.safeParse(userIdRaw);
  return parsed.success ? { clerkUserId: parsed.data } : {};
}

/** Paid-order list scope: all shoppers or a single Clerk account. */
export function resolveAdminPaidOrdersScope(
  userId?: string,
): "allPaidOrders" | { ownerClerkUserId: string } {
  return userId ? { ownerClerkUserId: userId } : "allPaidOrders";
}

export function matchesAdminCustomerFilter(
  clerkUserId: string,
  filterClerkUserId?: string,
): boolean {
  return !filterClerkUserId || clerkUserId === filterClerkUserId;
}

function mergeUserIdIntoParams(
  params: URLSearchParams,
  userId?: string,
): URLSearchParams {
  if (userId) {
    params.set(ADMIN_CUSTOMER_FILTER_PARAM, userId);
  }
  return params;
}

/** Appends or removes the global customer filter on an existing href. */
export function withAdminCustomerFilter(
  href: string,
  clerkUserId?: string | null,
): string {
  const hashIdx = href.indexOf("#");
  const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const qIdx = base.indexOf("?");
  const pathname = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const params = new URLSearchParams(qIdx >= 0 ? base.slice(qIdx + 1) : "");
  if (clerkUserId) {
    params.set(ADMIN_CUSTOMER_FILTER_PARAM, clerkUserId);
  } else {
    params.delete(ADMIN_CUSTOMER_FILTER_PARAM);
  }
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash}`;
}

/** Builds an admin path href, preserving the current customer filter when set. */
export function buildAdminHref(
  pathname: string,
  opts?: {
    searchParams?: URLSearchParams | Record<string, string | undefined>;
    clerkUserId?: string | null;
  },
): string {
  const params = new URLSearchParams();
  if (opts?.searchParams) {
    if (opts.searchParams instanceof URLSearchParams) {
      opts.searchParams.forEach((value, key) => {
        if (key !== ADMIN_CUSTOMER_FILTER_PARAM) {
          params.set(key, value);
        }
      });
    } else {
      for (const [key, value] of Object.entries(opts.searchParams)) {
        if (value != null && value !== "" && key !== ADMIN_CUSTOMER_FILTER_PARAM) {
          params.set(key, value);
        }
      }
    }
  }
  mergeUserIdIntoParams(params, opts?.clerkUserId ?? undefined);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function filterAdminItemRequestGroups(
  groups: AdminItemRequestGroup[],
  clerkUserId?: string,
): AdminItemRequestGroup[] {
  if (!clerkUserId) return groups;
  return groups.filter((g) => g.clerkUserId === clerkUserId);
}

export function filterAdminQuoteHistoryGroups(
  groups: AdminQuoteHistoryGroup[],
  clerkUserId?: string,
): AdminQuoteHistoryGroup[] {
  if (!clerkUserId) return groups;
  return groups.filter((g) => g.clerkUserId === clerkUserId);
}

export function filterAdminSubmittedBatchBundles(
  bundles: AdminSubmittedBatchBundle[],
  clerkUserId?: string,
): AdminSubmittedBatchBundle[] {
  if (!clerkUserId) return bundles;
  return bundles.filter((b) => b.session.clerkUserId === clerkUserId);
}

export function filterAdminBatchHistoryBundles(
  bundles: AdminBatchHistoryBundle[],
  clerkUserId?: string,
): AdminBatchHistoryBundle[] {
  if (!clerkUserId) return bundles;
  return bundles.filter((b) => b.session.clerkUserId === clerkUserId);
}

export function filterAdminBatchHistoryOwnerBundles(
  bundles: AdminBatchHistoryOwnerBundle[],
  clerkUserId?: string,
): AdminBatchHistoryOwnerBundle[] {
  if (!clerkUserId) return bundles;
  return bundles.filter((b) => b.session.clerkUserId === clerkUserId);
}

export function appendAdminListQueryToParams(
  params: URLSearchParams,
  query: Partial<AdminListQuery>,
): URLSearchParams {
  const qTrim = query.q?.trim();
  if (qTrim) {
    params.set("q", qTrim);
  }
  if (query.page != null && query.page > 1) {
    params.set("page", String(query.page));
  }
  if (query.ps != null && query.ps !== 25) {
    params.set("ps", String(query.ps));
  }
  if (query.sort != null && query.sort !== "order_date_desc") {
    params.set("sort", query.sort);
  }
  mergeUserIdIntoParams(params, query.userId);
  return params;
}
