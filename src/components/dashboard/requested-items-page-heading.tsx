import Link from "next/link";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Shared headline for `/dashboard/items/requested-items` and submission sub-routes. */
export function RequestedItemsPageHeading() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Requested items
      </h1>
      <p className="text-sm text-muted-foreground">
        Paste a product link, optionally run AI to pull listing details, then submit for
        staff to review and quote. You can edit every field yourself.{" "}
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
