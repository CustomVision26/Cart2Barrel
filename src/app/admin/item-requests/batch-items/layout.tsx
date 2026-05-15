import { AdminBatchItemsSubTabNav } from "@/components/admin/admin-batch-items-sub-tab-nav";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminBatchItemsSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return <>{children}</>;
  }

  const { submittedBatchBundles, batchQuoteHistoryBundles, batchHistoryBundles } =
    result.payload;

  return (
    <div className="space-y-4">
      <AdminBatchItemsSubTabNav
        pendingSubmissionCount={submittedBatchBundles.length}
        estimateHistoryCount={batchQuoteHistoryBundles.length}
        batchHistoryCount={batchHistoryBundles.length}
      />
      {children}
    </div>
  );
}
