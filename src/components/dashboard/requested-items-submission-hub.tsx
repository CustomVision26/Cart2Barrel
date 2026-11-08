import Link from "next/link";
import { ClipboardList, Sparkles } from "lucide-react";

import {
  DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE,
  DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE,
} from "@/lib/dashboard-items-routes";
import {
  SHOPPING_LIST_CARD_DESCRIPTION,
  SHOPPING_LIST_CARD_TITLE,
} from "@/lib/shopping-list-copy";
import { cn } from "@/lib/utils";

const cardClass = cn(
  "group block rounded-2xl border border-border bg-card p-6 shadow-sm transition-all",
  "outline-none hover:border-primary/50 hover:shadow-md",
  "focus-visible:ring-2 focus-visible:ring-ring",
);

/** Primary entries from `/dashboard/items/requested-items` to submit a request. */
export function RequestedItemsSubmissionHub() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:max-w-4xl">
      <Link href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE} className={cardClass}>
        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          Start a Request
        </span>
        <span className="mt-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          Product link
        </span>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a product URL, preview the listing, optionally run AI to draft details and
          a merchandise estimate—then submit for staff to review and quote. You can edit
          every field yourself before sending.
        </p>
      </Link>
      <Link href={DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE} className={cardClass}>
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Start a Request
        </span>
        <span className="mt-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
          {SHOPPING_LIST_CARD_TITLE}
        </span>
        <p className="mt-2 text-sm text-muted-foreground">
          {SHOPPING_LIST_CARD_DESCRIPTION}
        </p>
      </Link>
    </div>
  );
}
