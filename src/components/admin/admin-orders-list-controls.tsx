import Link from "next/link";

import type { AdminListQuery } from "@/lib/admin-customer-filter";
import { ADMIN_CUSTOMER_FILTER_PARAM } from "@/lib/admin-customer-filter";
import {
  buildAdminOrdersListHref,
  paidOrderLineSortValues,
  type PaidOrderLineSort,
} from "@/lib/paid-orders-list-params";

function sortOptionLabel(sort: PaidOrderLineSort): string {
  switch (sort) {
    case "order_date_desc":
      return "Order date (newest)";
    case "order_date_asc":
      return "Order date (oldest)";
    case "line_total_desc":
      return "Order line total sum (high → low)";
    case "line_total_asc":
      return "Order line total sum (low → high)";
    case "customer_az":
      return "Customer (A–Z)";
    case "customer_za":
      return "Customer (Z–A)";
    case "product_az":
      return "First product title (A–Z)";
    case "product_za":
      return "First product title (Z–A)";
    case "batch_az":
      return "Batch number (A–Z)";
    case "batch_za":
      return "Batch number (Z–A)";
    case "status_az":
      return "Fulfillment status (A–Z)";
    case "status_za":
      return "Fulfillment status (Z–A)";
    default:
      return sort;
  }
}

export function AdminOrdersListControls(props: {
  query: AdminListQuery;
  totalOrders: number;
  page: number;
  totalPages: number;
  pageSize: number;
  basePath?: "/admin/orders" | "/admin/orders-history";
}) {
  const {
    query,
    totalOrders,
    page,
    totalPages,
    pageSize,
    basePath = "/admin/orders",
  } = props;
  const start = totalOrders === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalOrders);

  return (
    <div className="space-y-4">
      <form
        method="GET"
        action={basePath}
        className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label
            htmlFor="admin-orders-q"
            className="block text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <input
            id="admin-orders-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Batch # · batch session id · order id · request id · line id · Stripe ref · notes · customer email · product …"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoComplete="off"
          />
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1.5 sm:w-48">
          <label
            htmlFor="admin-orders-sort"
            className="block text-xs font-medium text-muted-foreground"
          >
            Sort
          </label>
          <select
            id="admin-orders-sort"
            name="sort"
            defaultValue={query.sort}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paidOrderLineSortValues.map((s) => (
              <option key={s} value={s}>
                {sortOptionLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[5rem] flex-col gap-1.5 sm:w-36">
          <label
            htmlFor="admin-orders-ps"
            className="block text-xs font-medium text-muted-foreground"
          >
            Orders per page
          </label>
          <select
            id="admin-orders-ps"
            name="ps"
            defaultValue={String(pageSize)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      </form>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Lists are grouped by checkout order below. Pagination counts{" "}
        <span className="font-medium text-foreground">orders</span>; each expanded order shows all paid
        lines (batch sub-groups + singles). Pagination links preserve search and sort.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted-foreground">
        <p>
          {totalOrders === 0 ?
            "No matching orders."
          : <>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">{start}</span>
              –
              <span className="font-medium tabular-nums text-foreground">{end}</span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {totalOrders}
              </span>{" "}
              orders
              {totalPages > 1 ?
                <>
                  {" "}
                  · page{" "}
                  <span className="font-medium tabular-nums text-foreground">{page}</span>{" "}
                  / {totalPages}
                </>
              : null}
            </>
          }
        </p>

        <nav className="flex items-center gap-2" aria-label="Pagination">
          {page > 1 ?
            <Link
              href={buildAdminOrdersListHref({
                q: query.q,
                sort: query.sort,
                ps: query.ps,
                page: page - 1,
                basePath,
              })}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
              prefetch={false}
            >
              Previous
            </Link>
          : (
            <span className="cursor-not-allowed rounded-md border border-border/50 px-3 py-1.5 text-sm font-medium opacity-45">
              Previous
            </span>
          )}
          {page < totalPages ?
            <Link
              href={buildAdminOrdersListHref({
                q: query.q,
                sort: query.sort,
                ps: query.ps,
                page: page + 1,
                basePath,
              })}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
              prefetch={false}
            >
              Next
            </Link>
          : (
            <span className="cursor-not-allowed rounded-md border border-border/50 px-3 py-1.5 text-sm font-medium opacity-45">
              Next
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}
