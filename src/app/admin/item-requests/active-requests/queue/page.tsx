import { AdminItemRequestsGroupedTable } from "@/components/admin/admin-item-requests-grouped-table";
import { loadAdminItemRequestsQueuePagePayload } from "@/data/admin-item-requests-page-payload";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { quoteRecordedByClerkUserId } from "@/lib/admin-staff-profiles";
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import {
  groupReturnRequestsByItemRequestId,
  listOutsidePurchaseReturnRequestsByItemRequestIds,
} from "@/data/outside-purchase-return-requests";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminItemRequestsQueuePage({ searchParams }: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const [result, merchantEstimateFees] = await Promise.all([
    loadAdminItemRequestsQueuePagePayload(clerkUserId),
    getMerchantPricingForEstimates(),
  ]);

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const {
    payload: {
      groups: queueGroups,
      hasActiveQueue,
      snapshotsByRequestId,
      activeQueueLatestQuotesByRequestId,
    },
  } = result;

  if (queueGroups.length > 0) {
    const queueRequestIds = queueGroups.flatMap((g) =>
      g.activeQueueRequests.map((row) => row.request.id),
    );
    const [returnRows, orderContextByRequestId, staffProfilesByClerkUserId] =
      await Promise.all([
        listOutsidePurchaseReturnRequestsByItemRequestIds(queueRequestIds),
        getOrderContextByItemRequestIds(queueRequestIds),
        loadAdminStaffProfilesByClerkUserIds(
          queueRequestIds.map(
            (id) =>
              quoteRecordedByClerkUserId(activeQueueLatestQuotesByRequestId[id]),
          ),
        ),
      ]);
    const returnRequestsByItemRequestId =
      groupReturnRequestsByItemRequestId(returnRows);

    return (
      <AdminItemRequestsGroupedTable
        groups={queueGroups}
        snapshotsByRequestId={snapshotsByRequestId}
        latestQuotesByRequestId={activeQueueLatestQuotesByRequestId}
        staffProfilesByClerkUserId={staffProfilesByClerkUserId}
        returnRequestsByItemRequestId={returnRequestsByItemRequestId}
        orderContextByRequestId={Object.fromEntries(orderContextByRequestId)}
        merchantEstimateFees={merchantEstimateFees}
        introHelp={
          <>
            Active requests has a Queue sub-tab grouping each account&apos;s in-flight
            work—new submissions, customer resends (request new estimate), and quoted
            lines awaiting acceptance—and a Quote history sub-tab for staff single-line
            estimate revisions (voided quotes from customer resends stay off that list).
            Batch Items separates submitted bundles from archived batch estimates
            (sub-tabs).
          </>
        }
      />
    );
  }

  if (!hasActiveQueue) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing in the active queue right now (no pending, resend, or quoted items).
      </p>
    );
  }

  return null;
}
