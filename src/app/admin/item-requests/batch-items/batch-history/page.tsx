import { AdminBatchHistoryTable } from "@/components/admin/admin-batch-history-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import {
  filterAdminBatchHistoryBundles,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBatchItemsBatchHistoryPage({
  searchParams,
}: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { batchHistoryBundles } = result.payload;

  return (
    <AdminBatchHistoryTable
      bundles={filterAdminBatchHistoryBundles(batchHistoryBundles, clerkUserId)}
    />
  );
}
