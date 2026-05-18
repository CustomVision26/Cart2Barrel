import { AdminItemRequestsGroupedTable } from "@/components/admin/admin-item-requests-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import {
  groupReturnRequestsByItemRequestId,
  listOutsidePurchaseReturnRequestsByItemRequestIds,
} from "@/data/outside-purchase-return-requests";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import {
  filterAdminItemRequestGroups,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminItemRequestsQueuePage({ searchParams }: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const result = await loadAdminItemRequestsPagePayload();
  const merchantEstimateFees = await getMerchantPricingForEstimates();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const {
    payload: {
      groups,
      hasActiveQueue,
      snapshotsByRequestId,
      activeQueueLatestQuotesByRequestId,
    },
  } = result;

  const queueGroups = filterAdminItemRequestGroups(
    groups.filter((g) => g.activeQueueCount > 0),
    clerkUserId,
  );

  if (queueGroups.length > 0) {
    const queueRequestIds = queueGroups.flatMap((g) =>
      g.activeQueueRequests.map((row) => row.request.id),
    );
    const returnRows = await listOutsidePurchaseReturnRequestsByItemRequestIds(
      queueRequestIds,
    );
    const returnRequestsByItemRequestId =
      groupReturnRequestsByItemRequestId(returnRows);

    return (
      <AdminItemRequestsGroupedTable
        groups={queueGroups}
        snapshotsByRequestId={snapshotsByRequestId}
        latestQuotesByRequestId={activeQueueLatestQuotesByRequestId}
        returnRequestsByItemRequestId={returnRequestsByItemRequestId}
        merchantEstimateFees={merchantEstimateFees}
      />
    );
  }

  return (
    <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      Nothing in the active queue right now (no pending, resend, or quoted items).
    </p>
  );
}
