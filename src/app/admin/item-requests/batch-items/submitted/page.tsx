import { redirect } from "next/navigation";

import { AdminBatchItemsTable } from "@/components/admin/admin-batch-items-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { listSubmittedBatchSessionsForAdminPage } from "@/data/batch-quote-sessions";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { batchEstimateRecordedByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  filterAdminSubmittedBatchBundles,
  parseAdminCustomerFilter,
  withAdminCustomerFilter,
} from "@/lib/admin-customer-filter";
import {
  adminSubmittedBatchListHrefMerge,
  parseAdminSubmittedBatchListQuery,
} from "@/lib/admin-submitted-batch-list-params";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBatchItemsSubmittedPage({
  searchParams,
}: PageProps) {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const sp = (await searchParams) ?? {};
  const { clerkUserId } = parseAdminCustomerFilter(sp);
  const query = parseAdminSubmittedBatchListQuery(sp);
  const pageResult = await listSubmittedBatchSessionsForAdminPage(query);
  const bundles = filterAdminSubmittedBatchBundles(pageResult.bundles, clerkUserId);
  const totalCount = clerkUserId ? bundles.length : pageResult.totalCount;
  const queueTotalCount = filterAdminSubmittedBatchBundles(
    result.payload.submittedBatchBundles,
    clerkUserId,
  ).length;

  const maxPage = Math.max(1, Math.ceil(totalCount / query.pageSize));

  const hrefFor = (patch: Partial<typeof query>) =>
    withAdminCustomerFilter(
      adminSubmittedBatchListHrefMerge(query, patch),
      clerkUserId,
    );

  if (totalCount === 0 && query.page > 1) {
    redirect(hrefFor({ page: 1 }));
  }

  if (totalCount > 0 && query.page > maxPage) {
    redirect(hrefFor({ page: maxPage }));
  }

  const staffProfilesByClerkUserId = await loadAdminStaffProfilesByClerkUserIds(
    bundles.map((bundle) =>
      batchEstimateRecordedByClerkUserId(bundle.latestEstimate),
    ),
  );

  return (
    <AdminBatchItemsTable
      bundles={bundles}
      listQuery={query}
      totalCount={totalCount}
      queueTotalCount={queueTotalCount}
      staffProfilesByClerkUserId={staffProfilesByClerkUserId}
    />
  );
}
