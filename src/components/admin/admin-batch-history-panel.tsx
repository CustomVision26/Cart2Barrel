"use client";

import Link from "next/link";

import { DashboardBatchHistorySection } from "@/components/dashboard/dashboard-batch-history-section";
import type { AdminBatchHistoryOwnerBundle } from "@/data/batch-quote-sessions";
import type { ItemQuote } from "@/db/schema";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

type AdminBatchHistoryPanelProps = {
  bundles: AdminBatchHistoryOwnerBundle[];
  quotesByRequestId: Record<string, ItemQuote[]>;
};

export function AdminBatchHistoryPanel({
  bundles,
  quotesByRequestId,
}: AdminBatchHistoryPanelProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Chronological record of bundled requests shoppers sent to staff and batch estimates
        saved for them. Open batches still awaiting a quote stay under{" "}
        <Link
          href={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Submitted batches
        </Link>
        .
      </p>
      <DashboardBatchHistorySection
        variant="admin"
        bundles={bundles}
        quotesByRequestId={quotesByRequestId}
        linkTargets={{
          batchQuotesActive: ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted,
          orders: "/admin/orders",
          cart: "/admin/orders",
        }}
      />
    </>
  );
}
