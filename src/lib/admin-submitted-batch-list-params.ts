import { z } from "zod";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

export const ADMIN_SUBMITTED_BATCH_LIST_SORT_KEYS = [
  "submitted",
  "batch",
  "site",
  "customer",
  "lines",
] as const;

export type AdminSubmittedBatchListSortKey =
  (typeof ADMIN_SUBMITTED_BATCH_LIST_SORT_KEYS)[number];

export const ADMIN_SUBMITTED_BATCH_PAGE_SIZES = [5, 10, 20, 50, 100] as const;

export type AdminSubmittedBatchPageSize =
  (typeof ADMIN_SUBMITTED_BATCH_PAGE_SIZES)[number];

export const adminSubmittedBatchListQuerySchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(50),
    z.literal(100),
  ]),
  sort: z.enum(ADMIN_SUBMITTED_BATCH_LIST_SORT_KEYS),
  dir: z.enum(["asc", "desc"]),
  q: z.string().max(200),
});

export type AdminSubmittedBatchListQuery = z.infer<
  typeof adminSubmittedBatchListQuerySchema
>;

const DEFAULT_QUERY: AdminSubmittedBatchListQuery = {
  page: 1,
  pageSize: 20,
  sort: "submitted",
  dir: "desc",
  q: "",
};

function pickParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Parse `searchParams` for `/admin/item-requests/batch-items/submitted`.
 */
export function parseAdminSubmittedBatchListQuery(
  sp: Record<string, string | string[] | undefined>
): AdminSubmittedBatchListQuery {
  const pageRaw = parseInt(String(pickParam(sp, "page") ?? "1"), 10);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_QUERY.page;

  const psRaw = parseInt(String(pickParam(sp, "pageSize") ?? "20"), 10);
  const pageSize = ADMIN_SUBMITTED_BATCH_PAGE_SIZES.includes(
    psRaw as AdminSubmittedBatchPageSize,
  )
    ? (psRaw as AdminSubmittedBatchPageSize)
    : DEFAULT_QUERY.pageSize;

  const sortRaw = pickParam(sp, "sort") ?? DEFAULT_QUERY.sort;
  const sort = ADMIN_SUBMITTED_BATCH_LIST_SORT_KEYS.includes(
    sortRaw as AdminSubmittedBatchListSortKey,
  )
    ? (sortRaw as AdminSubmittedBatchListSortKey)
    : DEFAULT_QUERY.sort;

  const dirRaw = pickParam(sp, "dir") ?? DEFAULT_QUERY.dir;
  const dir =
    dirRaw === "asc" || dirRaw === "desc"
      ? dirRaw
      : DEFAULT_QUERY.dir;

  const q = (pickParam(sp, "q") ?? "").trim().slice(0, 200);

  const candidate: AdminSubmittedBatchListQuery = {
    page,
    pageSize,
    sort,
    dir,
    q,
  };

  const parsed = adminSubmittedBatchListQuerySchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_QUERY;
}

export function adminSubmittedBatchListHref(
  q: AdminSubmittedBatchListQuery
): string {
  const p = new URLSearchParams();
  p.set("page", String(q.page));
  p.set("pageSize", String(q.pageSize));
  p.set("sort", q.sort);
  p.set("dir", q.dir);
  if (q.q) p.set("q", q.q);
  return `${ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted}?${p.toString()}`;
}

export function adminSubmittedBatchListHrefMerge(
  current: AdminSubmittedBatchListQuery,
  patch: Partial<AdminSubmittedBatchListQuery>
): string {
  return adminSubmittedBatchListHref({ ...current, ...patch });
}
