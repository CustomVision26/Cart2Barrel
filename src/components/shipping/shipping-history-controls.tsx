import Link from "next/link";

import {
  buildShippingHistoryHref,
  SHIPPING_HISTORY_PAGE_SIZES,
  SHIPPING_HISTORY_SORT_VALUES,
  type ShippingHistoryQuery,
  type ShippingHistorySort,
} from "@/lib/shipping-history-params";
import type { ShippingHistoryAudience } from "@/lib/barrel-shipping-history";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { ADMIN_SHIPMENTS_ROUTES } from "@/lib/admin-shipments-routes";

function sortOptionLabel(sort: ShippingHistorySort): string {
  switch (sort) {
    case "shipped_desc":
      return "Shipped (newest)";
    case "shipped_asc":
      return "Shipped (oldest)";
    case "name_az":
      return "Container name (A–Z)";
    case "name_za":
      return "Container name (Z–A)";
    case "status_az":
      return "Status (A–Z)";
    case "freight_az":
      return "Freight company (A–Z)";
    case "customer_az":
      return "Customer (A–Z)";
    case "customer_za":
      return "Customer (Z–A)";
    default:
      return sort;
  }
}

export function ShippingHistoryControls({
  query,
  total,
  page,
  totalPages,
  pageSize,
  audience = "customer",
  basePath,
  userId,
}: {
  query: ShippingHistoryQuery;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  audience?: ShippingHistoryAudience;
  basePath?: string;
  userId?: string;
}) {
  const path =
    basePath ??
    (audience === "admin"
      ? ADMIN_SHIPMENTS_ROUTES.history
      : DASHBOARD_SHIPPING_ROUTES.history);
  const sortValues =
    audience === "admin"
      ? SHIPPING_HISTORY_SORT_VALUES
      : SHIPPING_HISTORY_SORT_VALUES.filter(
          (sort) => sort !== "customer_az" && sort !== "customer_za",
        );
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hrefOpts = {
    q: query.q,
    sort: query.sort,
    ps: query.ps,
    basePath: path,
    userId,
  };

  return (
    <div className="space-y-4">
      <form
        method="GET"
        action={path}
        className="flex flex-col gap-4 rounded-lg border border-border/80 bg-muted p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label
            htmlFor="shipping-history-q"
            className="block text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <input
            id="shipping-history-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={
              audience === "admin"
                ? "Customer, container, freight, broker, courier, payment ref…"
                : "Container, freight, broker, courier, payment ref…"
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoComplete="off"
          />
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1.5 sm:w-52">
          <label
            htmlFor="shipping-history-sort"
            className="block text-xs font-medium text-muted-foreground"
          >
            Sort
          </label>
          <select
            id="shipping-history-sort"
            name="sort"
            defaultValue={query.sort}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sortValues.map((sort) => (
              <option key={sort} value={sort}>
                {sortOptionLabel(sort)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[5rem] flex-col gap-1.5 sm:w-36">
          <label
            htmlFor="shipping-history-ps"
            className="block text-xs font-medium text-muted-foreground"
          >
            Per page
          </label>
          <select
            id="shipping-history-ps"
            name="ps"
            defaultValue={String(pageSize)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SHIPPING_HISTORY_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="page" value="1" />
        {userId ?
          <input type="hidden" name="userId" value={userId} />
        : null}
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          {total === 0 ?
            query.q.trim()
              ? "No shipped containers match this search."
              : "No shipped containers yet."
          : <>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">{start}</span>
              –
              <span className="font-medium tabular-nums text-foreground">{end}</span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">{total}</span>{" "}
              containers
              {totalPages > 1 ?
                <>
                  {" "}
                  · page{" "}
                  <span className="font-medium tabular-nums text-foreground">{page}</span>
                  {" / "}
                  {totalPages}
                </>
              : null}
            </>
          }
        </p>
        <nav className="flex items-center gap-2" aria-label="Pagination">
          {page > 1 ?
            <Link
              href={buildShippingHistoryHref({
                ...hrefOpts,
                page: page - 1,
              })}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
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
              href={buildShippingHistoryHref({
                ...hrefOpts,
                page: page + 1,
              })}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
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
