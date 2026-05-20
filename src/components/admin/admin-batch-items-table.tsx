"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminSubmittedBatchBundle } from "@/data/batch-quote-sessions";
import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { AdminBatchQuoteEstimateDialog } from "@/components/admin/admin-batch-quote-estimate-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import {
  ADMIN_SUBMITTED_BATCH_PAGE_SIZES,
  adminSubmittedBatchListHrefMerge,
  type AdminSubmittedBatchListQuery,
} from "@/lib/admin-submitted-batch-list-params";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
};

export function AdminBatchItemsTable({
  bundles,
  listQuery,
  totalCount,
  queueTotalCount,
}: AdminBatchItemsTableProps) {
  const { hrefWithFilter } = useAdminCustomerFilter();
  const listHref = (patch: Partial<AdminSubmittedBatchListQuery>) =>
    hrefWithFilter(adminSubmittedBatchListHrefMerge(listQuery, patch));
  const router = useRouter();
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);

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

      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Find & organize</p>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="admin-batch-submitted-find-organize"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Show filters and sort
            </Label>
            <Switch
              id="admin-batch-submitted-find-organize"
              checked={findOrganizeVisible}
              onCheckedChange={setFindOrganizeVisible}
            />
          </div>
        </div>

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
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {listQuery.page > 1 ? (
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
              {listQuery.page < maxPage ? (
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
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Submitted</th>
                  <th className="px-3 py-2.5 font-medium">Batch</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Site</th>
                  <th className="px-3 py-2.5 font-medium">Lines</th>
                  <th className="px-3 py-2.5 font-medium">Estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bundles.map(({ session, requests, userFullName, userEmail, isCustomerResend }) => (
                  <tr key={session.id}>
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
                      <span className="font-medium text-foreground">
                        {userFullName?.trim() ||
                          userEmail?.trim() ||
                          session.clerkUserId.slice(0, 12)}
                      </span>
                      {userEmail?.trim() ? (
                        <span className="mt-1 block truncate text-xs">{userEmail}</span>
                      ) : null}
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 text-xs text-muted-foreground">
                      {session.siteKey}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {requests.length} product(s)
                    </td>
                    <td className="px-3 py-3 align-top">
                      <AdminBatchQuoteEstimateDialog
                        batchSessionId={session.id}
                        onSaved={() => router.refresh()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        </>
      )}
    </div>
  );
}
