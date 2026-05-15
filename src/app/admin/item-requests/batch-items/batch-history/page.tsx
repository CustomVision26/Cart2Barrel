import { AdminBatchHistoryTable } from "@/components/admin/admin-batch-history-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminBatchItemsBatchHistoryPage() {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { batchHistoryBundles } = result.payload;

  return <AdminBatchHistoryTable bundles={batchHistoryBundles} />;
}
