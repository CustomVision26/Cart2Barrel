import { AdminBatchQuoteHistoryPanel } from "@/components/admin/admin-batch-quote-history-panel";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { batchEstimateRecordedByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  filterAdminSubmittedBatchBundles,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBatchItemsBatchEstimatesPage({
  searchParams,
}: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { batchQuoteHistoryLatestQuotesByRequestId } = result.payload;
  const batchQuoteHistoryBundles = filterAdminSubmittedBatchBundles(
    result.payload.batchQuoteHistoryBundles,
    clerkUserId,
  );

  if (batchQuoteHistoryBundles.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No combined batch estimates on file yet. Saved batch quotes appear here after staff
        record an estimate from a submitted bundle.
      </p>
    );
  }

  const staffProfilesByClerkUserId = await loadAdminStaffProfilesByClerkUserIds(
    batchQuoteHistoryBundles.map((bundle) =>
      batchEstimateRecordedByClerkUserId(bundle.latestEstimate),
    ),
  );

  return (
    <AdminBatchQuoteHistoryPanel
      bundles={batchQuoteHistoryBundles}
      latestQuotesByRequestId={batchQuoteHistoryLatestQuotesByRequestId}
      staffProfilesByClerkUserId={staffProfilesByClerkUserId}
    />
  );
}
