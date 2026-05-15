"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { cn } from "@/lib/utils";

type AdminItemRequestsTabNavProps = {
  pendingBatchCount: number;
};

export function AdminItemRequestsTabNav({
  pendingBatchCount,
}: AdminItemRequestsTabNavProps) {
  const pathname = usePathname();

  const tabLinkClass = (selected: boolean) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      selected
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  const activeRequestsBranchActive =
    pathname === ADMIN_ITEM_REQUESTS_ROUTES.activeRequests ||
    pathname.startsWith(`${ADMIN_ITEM_REQUESTS_ROUTES.activeRequests}/`);

  const batchBranchActive =
    pathname === ADMIN_ITEM_REQUESTS_ROUTES.batchItems ||
    pathname.startsWith(`${ADMIN_ITEM_REQUESTS_ROUTES.batchItems}/`);

  return (
    <div
      role="tablist"
      aria-label="Item requests views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue}
        role="tab"
        aria-selected={activeRequestsBranchActive}
        className={tabLinkClass(activeRequestsBranchActive)}
      >
        Active requests
      </Link>
      <Link
        href={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted}
        role="tab"
        aria-selected={batchBranchActive}
        className={tabLinkClass(batchBranchActive)}
      >
        Batch Items
        {pendingBatchCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary">
            {pendingBatchCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
