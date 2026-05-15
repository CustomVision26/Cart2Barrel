"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { cn } from "@/lib/utils";

import { useAddItemPayload } from "./add-item-payload-context";

export function ItemsNewTabNav() {
  const pathname = usePathname();
  const { batchBundles } = useAddItemPayload();

  const activeBatchCount = batchBundles.filter(
    (b) => b.session.status !== "paid_pending_staff_purchase"
  ).length;

  return (
    <div
      role="tablist"
      aria-label="Products and batch quotes"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
        role="tab"
        aria-selected={pathname.startsWith(
          `${DASHBOARD_ADD_ITEM_ROUTES.products}/`
        )}
        className={cn(
          "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          pathname.startsWith(`${DASHBOARD_ADD_ITEM_ROUTES.products}/`)
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Products
      </Link>
      <Link
        href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
        role="tab"
        aria-selected={pathname.startsWith(
          `${DASHBOARD_ADD_ITEM_ROUTES.batchQuotes}/`
        )}
        className={cn(
          "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          pathname.startsWith(`${DASHBOARD_ADD_ITEM_ROUTES.batchQuotes}/`)
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Batch Quotes
        {activeBatchCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[10px]">
            {activeBatchCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
