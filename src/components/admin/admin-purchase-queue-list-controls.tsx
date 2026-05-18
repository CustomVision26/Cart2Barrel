import Link from "next/link";

import type { AdminListQuery } from "@/lib/admin-customer-filter";
import { ADMIN_CUSTOMER_FILTER_PARAM } from "@/lib/admin-customer-filter";
import { buildAdminPurchaseOrdersListHref } from "@/lib/paid-orders-list-params";

export function AdminPurchaseQueueListControls(props: {
  query: AdminListQuery;
  totalLines: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  const { query, totalLines, page, totalPages, pageSize } = props;
  const start = totalLines === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalLines);

  return (
    <div className="space-y-4">
      <form
        method="GET"
        action="/admin/purchase-orders"
        className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label
            htmlFor="admin-purchase-q"
            className="block text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <input
            id="admin-purchase-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Same as Orders: batch # · order / request id · customer · product …"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoComplete="off"
          />
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1.5 sm:w-52">
          <label
            htmlFor="admin-purchase-sort"
            className="block text-xs font-medium text-muted-foreground"
          >
            Order date
          </label>
          <select
            id="admin-purchase-sort"
            name="sort"
            defaultValue={query.sort === "order_date_asc" ? "order_date_asc" : "order_date_desc"}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="order_date_desc">Newest first</option>
            <option value="order_date_asc">Oldest first</option>
          </select>
        </div>
        <div className="flex min-w-[5rem] flex-col gap-1.5 sm:w-36">
          <label
            htmlFor="admin-purchase-ps"
            className="block text-xs font-medium text-muted-foreground"
          >
            Lines per page
          </label>
          <select
            id="admin-purchase-ps"
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
        One row per paid line that still needs a company purchase. Use{" "}
        <span className="font-medium text-foreground">Review and approve</span>, then{" "}
        <span className="font-medium text-foreground">Approve purchase</span>, after buying from the
        retailer. For the full paid order context, open{" "}
        <Link href="/admin/orders" className="font-medium text-primary underline-offset-4 hover:underline">
          Orders
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted-foreground">
        <p>
          {totalLines === 0 ?
            "No lines awaiting purchase."
          : <>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">{start}</span>
              –
              <span className="font-medium tabular-nums text-foreground">{end}</span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">{totalLines}</span> lines
              {totalPages > 1 ?
                <>
                  {" "}
                  · page{" "}
                  <span className="font-medium tabular-nums text-foreground">{page}</span> /{" "}
                  {totalPages}
                </>
              : null}
            </>
          }
        </p>

        <nav className="flex items-center gap-2" aria-label="Pagination">
          {page > 1 ?
            <Link
              href={buildAdminPurchaseOrdersListHref({
                q: query.q,
                sort: query.sort,
                ps: query.ps,
                page: page - 1,
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
              href={buildAdminPurchaseOrdersListHref({
                q: query.q,
                sort: query.sort,
                ps: query.ps,
                page: page + 1,
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
