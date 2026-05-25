import { AdminBatchHistoryTable } from "@/components/admin/admin-batch-history-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import {
  batchEstimateRecordedByClerkUserId,
  snapshotRecordedByClerkUserId,
} from "@/lib/admin-staff-profiles";
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
  const filteredBundles = filterAdminBatchHistoryBundles(
    batchHistoryBundles,
    clerkUserId,
  );

  const staffProfilesByClerkUserId = await loadAdminStaffProfilesByClerkUserIds([
    ...filteredBundles.flatMap((bundle) =>
      bundle.estimateRevisions.map((est) =>
        batchEstimateRecordedByClerkUserId(est),
      ),
    ),
    ...filteredBundles.flatMap((bundle) =>
      bundle.lines.map((line) =>
        snapshotRecordedByClerkUserId(line.estimateAdminSnapshot),
      ),
    ),
  ]);

  return (
    <AdminBatchHistoryTable
      bundles={filteredBundles}
      staffProfilesByClerkUserId={staffProfilesByClerkUserId}
    />
  );
}
