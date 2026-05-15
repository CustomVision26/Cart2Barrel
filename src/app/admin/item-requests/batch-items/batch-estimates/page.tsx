import { AdminBatchQuoteHistoryPanel } from "@/components/admin/admin-batch-quote-history-panel";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminBatchItemsBatchEstimatesPage() {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { batchQuoteHistoryBundles, batchQuoteHistoryLatestQuotesByRequestId } =
    result.payload;

  if (batchQuoteHistoryBundles.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No combined batch estimates on file yet. Saved batch quotes appear here after staff
        record an estimate from a submitted bundle.
      </p>
    );
  }

  return (
    <AdminBatchQuoteHistoryPanel
      bundles={batchQuoteHistoryBundles}
      latestQuotesByRequestId={batchQuoteHistoryLatestQuotesByRequestId}
    />
  );
}
