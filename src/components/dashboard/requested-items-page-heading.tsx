import Link from "next/link";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Shared headline for `/dashboard/items/requested-items` and submission sub-routes. */
export function RequestedItemsPageHeading() {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Start a Request
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Requested items
      </h1>
      <p className="text-sm text-muted-foreground">
        Paste a product link, upload a list photo, or build a list from a merchandise budget.
        AI can draft details, then submit for staff to review. You can edit every field
        yourself.{" "}
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          View your requests
        </Link>
      </p>
    </div>
  );
}
