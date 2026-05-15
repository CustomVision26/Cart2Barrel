import Link from "next/link";
import { Sparkles } from "lucide-react";

import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";
import { cn } from "@/lib/utils";

/** Primary entry from `/dashboard/items/requested-items` to submit a request. */
export function RequestedItemsSubmissionHub() {
  return (
    <Link
      href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}
      className={cn(
        "block rounded-xl border border-border bg-muted/10 p-6 transition-colors",
        "outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring",
        "sm:max-w-xl",
      )}
    >
      <span className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Start a request
      </span>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a product URL, preview the listing, optionally run AI to draft details and
        a merchandise estimate—then submit for staff to review and quote. You can edit
        every field yourself before sending.
      </p>
    </Link>
  );
}
