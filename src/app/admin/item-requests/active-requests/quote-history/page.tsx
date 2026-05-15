import { AdminQuoteHistoryGroupedTable } from "@/components/admin/admin-quote-history-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminActiveRequestsQuoteHistoryPage() {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { quoteHistoryGroups, snapshotsByRequestId } = result.payload;

  return (
    <AdminQuoteHistoryGroupedTable
      groups={quoteHistoryGroups}
      snapshotsByRequestId={snapshotsByRequestId}
    />
  );
}
