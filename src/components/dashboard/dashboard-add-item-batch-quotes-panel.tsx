"use client";

import { HelpBalloon } from "@/components/ui/help-balloon";
import { useAddItemPayload } from "@/components/dashboard/add-item-payload-context";
import { DashboardBatchQuotesSection } from "@/components/dashboard/dashboard-batch-quotes-section";

export function DashboardAddItemBatchQuotesPanel() {
  const { batchBundles, quotesByRequestId } = useAddItemPayload();

  return (
    <>
      <p className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Active batch quotes</span>
        <HelpBalloon label="About active batch quotes" tooltipClassName="w-80">
          Track retailer-level batch requests grouped by Cart2Barrel batch numbers. Submit
          drafts to notify staff—they respond with a bundled estimate referencing every line
          listed.
        </HelpBalloon>
      </p>
      <DashboardBatchQuotesSection
        bundles={batchBundles}
        quotesByRequestId={quotesByRequestId}
      />
    </>
  );
}
