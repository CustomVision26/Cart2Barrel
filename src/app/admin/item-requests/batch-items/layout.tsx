import { AdminBatchItemsSubTabNav } from "@/components/admin/admin-batch-items-sub-tab-nav";
import { loadAdminItemRequestsNavState } from "@/data/admin-item-requests-page-payload";

export default async function AdminBatchItemsSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await loadAdminItemRequestsNavState();

  if (!result.ok || result.nav.noData) {
    return <>{children}</>;
  }

  const { nav } = result;

  return (
    <div className="space-y-4">
      <AdminBatchItemsSubTabNav
        pendingSubmissionCount={nav.pendingBatchCount}
        estimateHistoryCount={nav.batchQuoteHistoryCount}
        batchHistoryCount={nav.batchHistoryCount}
      />
      {children}
    </div>
  );
}
