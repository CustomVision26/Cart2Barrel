import Link from "next/link";

import type { AdminListQuery } from "@/lib/admin-customer-filter";
import { ADMIN_CUSTOMER_FILTER_PARAM } from "@/lib/admin-customer-filter";
import {
  buildAdminPackagesListHref,
  paidOrderLineSortValues,
  type PaidOrderLineSort,
} from "@/lib/paid-orders-list-params";

function sortOptionLabel(sort: PaidOrderLineSort): string {
  switch (sort) {
    case "order_date_desc":
      return "Newest order first";
    case "order_date_asc":
      return "Oldest order first";
    case "line_total_desc":
      return "Line value high to low";
    case "line_total_asc":
      return "Line value low to high";
    case "customer_az":
      return "Customer A-Z";
    case "customer_za":
      return "Customer Z-A";
    case "product_az":
      return "Product A-Z";
    case "product_za":
      return "Product Z-A";
    case "batch_az":
      return "Batch number A-Z";
    case "batch_za":
      return "Batch number Z-A";
    case "status_az":
      return "Status A-Z";
    case "status_za":
      return "Status Z-A";
  }
}

function pageLink(
  query: AdminListQuery,
  page: number,
): string {
  return buildAdminPackagesListHref({
    q: query.q,
    sort: query.sort,
    ps: query.ps,
    page,
  });
}

export function AdminPackagesListControls(props: {
  query: AdminListQuery;
  totalLines: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  const { query, totalLines, page, totalPages, pageSize } = props;
  const start = totalLines === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalLines);
  const hasActiveSearch = query.q.trim().length > 0;
  const hasCustomView =
    hasActiveSearch || query.sort !== "order_date_desc" || query.ps !== 25;
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  const visiblePages = Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Package control center
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Find warehouse-ready packages fast
            </h2>
            <p className="text-sm text-muted-foreground">
              Filter by product, customer, order, request, batch number, or
              session ID. Sort the receiving queue so warehouse staff can pick
              the next package with less scanning.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[24rem]">
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="text-muted-foreground">Matching lines</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {totalLines}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="text-muted-foreground">Page</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {page}/{totalPages}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="text-muted-foreground">Per page</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {pageSize}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form
        method="GET"
        action="/admin/packages"
        className="grid gap-3 p-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(12rem,16rem)_minmax(8rem,10rem)_auto_auto] lg:items-end"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="admin-packages-q"
            className="block text-xs font-medium text-muted-foreground"
          >
            Search / filter
          </label>
          <input
            id="admin-packages-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Customer, product, batch #, order id, request id..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="admin-packages-sort"
            className="block text-xs font-medium text-muted-foreground"
          >
            Sort by
          </label>
          <select
            id="admin-packages-sort"
            name="sort"
            defaultValue={query.sort}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paidOrderLineSortValues.map((sort) => (
              <option key={sort} value={sort}>
                {sortOptionLabel(sort)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="admin-packages-ps"
            className="block text-xs font-medium text-muted-foreground"
          >
            Lines / page
          </label>
          <select
            id="admin-packages-ps"
            name="ps"
            defaultValue={String(pageSize)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <input type="hidden" name="page" value="1" />
        {query.userId ?
          <input
            type="hidden"
            name={ADMIN_CUSTOMER_FILTER_PARAM}
            value={query.userId}
          />
        : null}
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {hasCustomView ?
          <Link
            href="/admin/packages"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/80"
            prefetch={false}
          >
            Reset
          </Link>
        : null}
      </form>

      <div className="flex flex-col gap-3 border-t border-border bg-background/60 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {totalLines === 0 ?
            "No package lines match this view."
          : <>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">{start}</span>
              {" - "}
              <span className="font-medium tabular-nums text-foreground">{end}</span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {totalLines}
              </span>{" "}
              package lines
            </>
          }
        </p>

        <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
          <Link
            href={pageLink(query, 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 aria-disabled:pointer-events-none aria-disabled:opacity-45"
            aria-disabled={page <= 1}
            prefetch={false}
          >
            First
          </Link>
          <Link
            href={pageLink(query, Math.max(1, page - 1))}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 aria-disabled:pointer-events-none aria-disabled:opacity-45"
            aria-disabled={page <= 1}
            prefetch={false}
          >
            Prev
          </Link>
          {visiblePages.map((pageNumber) => (
            <Link
              key={pageNumber}
              href={pageLink(query, pageNumber)}
              className={
                pageNumber === page ?
                  "rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
              }
              aria-current={pageNumber === page ? "page" : undefined}
              prefetch={false}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            href={pageLink(query, Math.min(totalPages, page + 1))}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 aria-disabled:pointer-events-none aria-disabled:opacity-45"
            aria-disabled={page >= totalPages}
            prefetch={false}
          >
            Next
          </Link>
          <Link
            href={pageLink(query, totalPages)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 aria-disabled:pointer-events-none aria-disabled:opacity-45"
            aria-disabled={page >= totalPages}
            prefetch={false}
          >
            Last
          </Link>
        </nav>
      </div>
    </section>
  );
}
