"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { AdminSubmittedBatchBundle } from "@/data/batch-quote-sessions";
import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { AdminBatchQuoteEstimateDialog } from "@/components/admin/admin-batch-quote-estimate-dialog";
import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { batchEstimateRecordedByClerkUserId } from "@/lib/admin-staff-profiles";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { adminParentControlsDisabledClass } from "@/lib/admin-parent-controls-disabled";
import {
  ADMIN_SUBMITTED_BATCH_PAGE_SIZES,
  adminSubmittedBatchListHrefMerge,
  type AdminSubmittedBatchListQuery,
} from "@/lib/admin-submitted-batch-list-params";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";
import type { ItemRequest } from "@/db/schema";

const SELECT_CLASS =
  "h-8 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const BATCH_TABLE_COL_SPAN = 8;

function submittedRequestMatchesSearch(r: ItemRequest, q: string): boolean {
  if (!q) return true;
  const parts = [
    r.id,
    r.productName,
    r.productUrl,
    r.siteName,
    r.productSize,
    r.productColor,
    r.status,
  ];
  return parts.some((p) => p != null && String(p).toLowerCase().includes(q));
}

function submittedLabel(session: AdminSubmittedBatchBundle["session"]): string {
  const raw = session.submittedAt?.trim()
    ? session.submittedAt
    : session.createdAt;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(raw).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type AdminBatchItemsTableProps = {
  bundles: AdminSubmittedBatchBundle[];
  listQuery: AdminSubmittedBatchListQuery;
  totalCount: number;
  queueTotalCount: number;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

export function AdminBatchItemsTable({
  bundles,
  listQuery,
  totalCount,
  queueTotalCount,
  staffProfilesByClerkUserId = {},
}: AdminBatchItemsTableProps) {
  const baseId = useId();
  const findOrganizeSwitchId = `${baseId}-find-organize`;
  const { hrefWithFilter } = useAdminCustomerFilter();
  const listHref = (patch: Partial<AdminSubmittedBatchListQuery>) =>
    hrefWithFilter(adminSubmittedBatchListHrefMerge(listQuery, patch));
  const router = useRouter();
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<5 | 10 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);

  const activeSessionId =
    panelChoiceMade ? openSessionId : (bundles[0]?.session.id ?? null);
  const batchExpanded = activeSessionId !== null;

  const toggleBatch = useCallback(
    (sessionId: string) => {
      setPanelChoiceMade(true);
      const next = activeSessionId === sessionId ? null : sessionId;
      if (next !== activeSessionId) {
        setLineSearch("");
        setLinePage(1);
      }
      setOpenSessionId(next);
    },
    [activeSessionId],
  );

  useEffect(() => {
    setPanelChoiceMade(false);
    setOpenSessionId(null);
    setLineSearch("");
    setLinePage(1);
  }, [
    listQuery.q,
    listQuery.page,
    listQuery.pageSize,
    listQuery.sort,
    listQuery.dir,
  ]);

  if (queueTotalCount === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No pending batch requests. Draft batches appear here after shoppers submit
        batch requests.
      </p>
    );
  }

  const maxPage = Math.max(1, Math.ceil(totalCount / listQuery.pageSize));
  const showFrom =
    totalCount === 0 ? 0 : (listQuery.page - 1) * listQuery.pageSize + 1;
  const showTo = Math.min(
    listQuery.page * listQuery.pageSize,
    totalCount,
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Shoppers grouped quoted lines into a single retailer-level request. Produce one
        combined estimate per batch below.
      </p>

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border bg-muted/10 p-4",
          adminParentControlsDisabledClass(batchExpanded),
        )}
        aria-hidden={batchExpanded || undefined}
      >
        <AdminFindOrganizeVisibilityToggle
          id={findOrganizeSwitchId}
          visible={findOrganizeVisible}
          onVisibleChange={setFindOrganizeVisible}
        />

        {findOrganizeVisible ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <form
              method="GET"
              action={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted}
              className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="page" value="1" />
              <input
                type="hidden"
                name="pageSize"
                value={listQuery.pageSize}
              />
              <input type="hidden" name="sort" value={listQuery.sort} />
              <input type="hidden" name="dir" value={listQuery.dir} />
              <Field className="min-w-0 flex-1 gap-1.5">
                <FieldLabel htmlFor="batch-submitted-search" className="text-xs">
                  Search
                </FieldLabel>
                <FieldContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="batch-submitted-search"
                    name="q"
                    placeholder="Batch #, site, customer name, email, or Clerk id…"
                    defaultValue={listQuery.q}
                    autoComplete="off"
                    className="min-w-0 sm:min-w-[16rem]"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button type="submit" size="sm" className="h-8">
                      Search
                    </Button>
                    {listQuery.q ? (
                      <Link
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-8 px-3",
                        )}
                        href={listHref({ ...listQuery, q: "", page: 1 })}
                      >
                        Clear
                      </Link>
                    ) : null}
                  </div>
                </FieldContent>
                <FieldDescription>
                  Case-insensitive match on any column in the table below.
                </FieldDescription>
              </Field>
            </form>

            <Field className="gap-1.5 lg:w-44">
              <FieldLabel htmlFor="batch-submitted-sort" className="text-xs">
                Sort by
              </FieldLabel>
              <FieldContent>
                <select
                  id="batch-submitted-sort"
                  className={cn(SELECT_CLASS, "w-full")}
                  value={listQuery.sort}
                  onChange={(e) => {
                    router.push(
                      listHref({
                        ...listQuery,
                        sort: e.target.value as AdminSubmittedBatchListQuery["sort"],
                        page: 1,
                      }),
                    );
                  }}
                >
                  <option value="submitted">Submitted date</option>
                  <option value="batch">Batch number</option>
                  <option value="site">Site</option>
                  <option value="customer">Customer</option>
                  <option value="lines">Line count</option>
                </select>
              </FieldContent>
            </Field>

            <Field className="gap-1.5 lg:w-36">
              <FieldLabel htmlFor="batch-submitted-dir" className="text-xs">
                Direction
              </FieldLabel>
              <FieldContent>
                <select
                  id="batch-submitted-dir"
                  className={cn(SELECT_CLASS, "w-full")}
                  value={listQuery.dir}
                  onChange={(e) => {
                    router.push(
                      listHref({
                        ...listQuery,
                        dir: e.target.value as AdminSubmittedBatchListQuery["dir"],
                        page: 1,
                      }),
                    );
                  }}
                >
                  <option value="desc">Newest / Z → A</option>
                  <option value="asc">Oldest / A → Z</option>
                </select>
              </FieldContent>
            </Field>

            <Field className="gap-1.5 lg:w-36">
              <FieldLabel htmlFor="batch-submitted-page-size" className="text-xs">
                Per page
              </FieldLabel>
              <FieldContent>
                <select
                  id="batch-submitted-page-size"
                  className={cn(SELECT_CLASS, "w-full")}
                  value={listQuery.pageSize}
                  onChange={(e) => {
                    const pageSize = Number(e.target.value);
                    if (
                      !ADMIN_SUBMITTED_BATCH_PAGE_SIZES.includes(
                        pageSize as (typeof ADMIN_SUBMITTED_BATCH_PAGE_SIZES)[number],
                      )
                    ) {
                      return;
                    }
                    router.push(
                      listHref({
                        ...listQuery,
                        pageSize: pageSize as AdminSubmittedBatchListQuery["pageSize"],
                        page: 1,
                      }),
                    );
                  }}
                >
                  {ADMIN_SUBMITTED_BATCH_PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </FieldContent>
            </Field>
          </div>
        ) : null}
      </div>

      {totalCount === 0 ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No batches match your search. Try another batch number, site key,
          customer name, email, or Clerk user id fragment.
        </p>
      ) : (
        <>
          <div
            className={cn(
              "flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
              adminParentControlsDisabledClass(batchExpanded),
            )}
            aria-hidden={batchExpanded || undefined}
          >
            <p>
              Showing{" "}
              <span className="tabular-nums font-medium text-foreground">
                {showFrom}–{showTo}
              </span>{" "}
              of{" "}
              <span className="tabular-nums font-medium text-foreground">
                {totalCount}
              </span>
              {listQuery.q ? (
                <>
                  {" "}
                  <span className="text-muted-foreground/80">(filtered)</span>
                </>
              ) : null}
              {batchExpanded ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  (collapse batch to change)
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {listQuery.page > 1 && !batchExpanded ? (
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 px-3",
                  )}
                  href={listHref({ ...listQuery, page: listQuery.page - 1 })}
                >
                  Previous
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none h-8 px-3 opacity-50",
                  )}
                >
                  Previous
                </span>
              )}
              <span className="tabular-nums text-muted-foreground">
                Page {listQuery.page} / {maxPage}
              </span>
              {listQuery.page < maxPage && !batchExpanded ? (
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 px-3",
                  )}
                  href={listHref({ ...listQuery, page: listQuery.page + 1 })}
                >
                  Next
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none h-8 px-3 opacity-50",
                  )}
                >
                  Next
                </span>
              )}
            </div>
          </div>

          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead
                className={cn(
                  "border-b border-border bg-muted/40",
                  adminParentControlsDisabledClass(batchExpanded),
                )}
                aria-hidden={batchExpanded || undefined}
              >
                <tr>
                  <th className="w-8 px-2 py-2.5" aria-hidden />
                  <th className="px-3 py-2.5 font-medium">Submitted</th>
                  <th className="px-3 py-2.5 font-medium">Batch</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Site</th>
                  <th className="px-3 py-2.5 font-medium">Lines</th>
                  <th className="min-w-[9rem] px-3 py-2.5 font-medium">Updated by</th>
                  <th className="px-3 py-2.5 font-medium">Estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bundles.map((bundle) => {
                  const {
                    session,
                    requests,
                    userFullName,
                    userEmail,
                    isCustomerResend,
                    latestEstimate,
                  } = bundle;
                  const expanded = activeSessionId === session.id;
                  const searchNorm = lineSearch.trim().toLowerCase();
                  const lineFiltered = requests.filter((r) =>
                    submittedRequestMatchesSearch(r, searchNorm),
                  );
                  const lineCount = lineFiltered.length;
                  const lineTotalPages = Math.max(
                    1,
                    Math.ceil(lineCount / linePageSize),
                  );
                  const linePageSafe = Math.min(
                    Math.max(1, linePage),
                    lineTotalPages,
                  );
                  const lineStart = (linePageSafe - 1) * linePageSize;
                  const requestSlice = lineFiltered.slice(
                    lineStart,
                    lineStart + linePageSize,
                  );
                  const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
                  const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

                  return (
                    <Fragment key={session.id}>
                      <tr
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/30",
                          expanded && "bg-muted/25",
                        )}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => toggleBatch(session.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleBatch(session.id);
                          }
                        }}
                      >
                        <td className="px-2 py-3 text-muted-foreground">
                          {expanded ? (
                            <ChevronDownIcon className="size-4" aria-hidden />
                          ) : (
                            <ChevronRightIcon className="size-4" aria-hidden />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                          <time
                            dateTime={
                              session.submittedAt?.trim()
                                ? session.submittedAt
                                : session.createdAt
                            }
                          >
                            {submittedLabel(session)}
                          </time>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-foreground">
                          {session.batchNumber}
                          <span
                            className={
                              isCustomerResend
                                ? "mt-1 block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:text-sky-300"
                                : "mt-1 block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400"
                            }
                          >
                            {isCustomerResend ? "Customer resend" : "New request"}
                          </span>
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 text-muted-foreground">
                          <AdminCustomerRecordLabel
                            clerkUserId={session.clerkUserId}
                            fullName={userFullName}
                            email={userEmail}
                            primaryClassName="text-sm font-medium"
                          />
                        </td>
                        <td className="max-w-[10rem] px-3 py-3 text-xs text-muted-foreground">
                          {session.siteKey}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-muted-foreground">
                          {requests.length} product(s)
                        </td>
                        <td className="min-w-[9rem] max-w-[11rem] px-3 py-3 align-top">
                          <AdminUpdatedByCell
                            clerkUserId={batchEstimateRecordedByClerkUserId(
                              latestEstimate,
                            )}
                            profilesByClerkUserId={staffProfilesByClerkUserId}
                          />
                        </td>
                        <td
                          className="px-3 py-3 align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AdminBatchQuoteEstimateDialog
                            batchSessionId={session.id}
                            onSaved={() => router.refresh()}
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-muted/10">
                          <td colSpan={BATCH_TABLE_COL_SPAN} className="p-0">
                            <div className="border-t border-border px-3 py-4">
                              <AdminNestedFindOrganizePanel
                                switchId={`${baseId}-line-find-organize-${session.id}`}
                                searchInputId={`${baseId}-line-search-${session.id}`}
                                pageSizeSelectId={`${baseId}-line-page-size-${session.id}`}
                                visible={lineFindOrganizeVisible}
                                onVisibleChange={setLineFindOrganizeVisible}
                                search={lineSearch}
                                onSearchChange={(value) => {
                                  setLineSearch(value);
                                  setLinePage(1);
                                }}
                                searchLabel="Search products"
                                searchPlaceholder="Product name, URL, site, size, color…"
                                pageSize={linePageSize}
                                onPageSizeChange={(size) => {
                                  setLinePageSize(size);
                                  setLinePage(1);
                                }}
                                pageSizeLabel="Products per page"
                                showFrom={lineShowFrom}
                                showTo={lineShowTo}
                                totalCount={lineCount}
                                totalLoaded={requests.length}
                                itemLabel="product"
                                className="mb-0"
                              />
                              {lineCount > linePageSize ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={linePageSafe <= 1}
                                    onClick={() =>
                                      setLinePage((p) => Math.max(1, p - 1))
                                    }
                                  >
                                    Previous products
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={linePageSafe >= lineTotalPages}
                                    onClick={() =>
                                      setLinePage((p) =>
                                        Math.min(lineTotalPages, p + 1),
                                      )
                                    }
                                  >
                                    Next products
                                  </Button>
                                </div>
                              ) : null}
                              {requestSlice.length === 0 ? (
                                <p className="mt-4 text-sm text-muted-foreground">
                                  {lineSearch.trim()
                                    ? "No products match the current search."
                                    : "No products in this batch."}
                                </p>
                              ) : (
                                <FloatingHorizontalScroll
                                  viewportClassName="mt-4 rounded-lg border border-border"
                                >
                                  <table className="w-full min-w-[40rem] text-left text-sm">
                                    <thead className="border-b border-border bg-muted/30">
                                      <tr>
                                        <th className="w-14 px-3 py-2 font-medium">
                                          Image
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Product
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Site
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Qty
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Size
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Color
                                        </th>
                                        <th className="min-w-[9rem] px-3 py-2 font-medium">
                                          Updated by
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {requestSlice.map((r) => (
                                        <tr key={r.id}>
                                          <td className="px-3 py-2">
                                            <ProductRequestThumbnail
                                              variant="list"
                                              imageUrl={r.productImageUrl}
                                              productLabel={r.productName}
                                            />
                                          </td>
                                          <td className="max-w-[14rem] px-3 py-2">
                                            <p className="line-clamp-2 font-medium text-foreground">
                                              {r.productName?.trim() || "Product"}
                                            </p>
                                            {r.productUrl?.trim() ? (
                                              <a
                                                href={r.productUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-0.5 block truncate text-xs text-primary hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {r.productUrl}
                                              </a>
                                            ) : null}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {displaySiteName(
                                              r.siteName,
                                              r.productUrl,
                                            )}
                                          </td>
                                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                            {r.quantity}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {r.productSize?.trim() || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {r.productColor?.trim() || "—"}
                                          </td>
                                          <td className="min-w-[9rem] max-w-[11rem] px-3 py-2 align-top">
                                            <AdminUpdatedByCell
                                              clerkUserId={null}
                                              profilesByClerkUserId={
                                                staffProfilesByClerkUserId
                                              }
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </FloatingHorizontalScroll>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        </>
      )}
    </div>
  );
}
