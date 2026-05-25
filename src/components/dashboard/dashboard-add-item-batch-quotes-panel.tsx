"use client";

import Link from "next/link";

import { HelpBalloon } from "@/components/ui/help-balloon";
import { useAddItemPayload } from "@/components/dashboard/add-item-payload-context";
import { DashboardBatchHistorySection } from "@/components/dashboard/dashboard-batch-history-section";
import { DashboardBatchQuotesSection } from "@/components/dashboard/dashboard-batch-quotes-section";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { cn } from "@/lib/utils";

type DashboardAddItemBatchQuotesPanelProps = {
  batchQuotesSubTab: "active" | "history";
};

export function DashboardAddItemBatchQuotesPanel({
  batchQuotesSubTab,
}: DashboardAddItemBatchQuotesPanelProps) {
  const { batchBundles } = useAddItemPayload();

  const subTabLinkClass = (tab: "active" | "history") =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      batchQuotesSubTab === tab
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  return (
    <>
      <div
        role="tablist"
        aria-label="Open batch quotes and batch history"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
          role="tab"
          aria-selected={batchQuotesSubTab === "active"}
          className={subTabLinkClass("active")}
          scroll={false}
        >
          Active
        </Link>
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesHistory}
          role="tab"
          aria-selected={batchQuotesSubTab === "history"}
          className={subTabLinkClass("history")}
          scroll={false}
        >
          History
        </Link>
      </div>

      {batchQuotesSubTab === "active" ? (
        <>
          <p className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Active batch quotes</span>
            <HelpBalloon label="About active batch quotes" tooltipClassName="w-80">
              Track retailer-level batch requests grouped by Cart2Barrel batch numbers. Submit
              drafts to notify staff—they respond with a bundled estimate referencing every line
              listed.
            </HelpBalloon>
          </p>
          <DashboardBatchQuotesSection bundles={batchBundles} />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Chronological record of bundled requests you sent to staff and batch estimates you
            received. Active drafts stay under{" "}
            <Link
              href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Batch Quotes
            </Link>
            .
          </p>
          <DashboardBatchHistorySection bundles={batchBundles} />
        </>
      )}
    </>
  );
}
