"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { customerPillTabClass, customerPillTablistClass } from "@/lib/customer-pill-tabs";
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
      className={customerPillTablistClass}
    >
      <Link
        href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
        role="tab"
        aria-selected={pathname.startsWith(
          `${DASHBOARD_ADD_ITEM_ROUTES.products}/`
        )}
        className={customerPillTabClass(
          pathname.startsWith(`${DASHBOARD_ADD_ITEM_ROUTES.products}/`),
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
          customerPillTabClass(
            pathname.startsWith(`${DASHBOARD_ADD_ITEM_ROUTES.batchQuotes}/`),
          ),
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
