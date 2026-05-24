import { AdminQuoteHistoryGroupedTable } from "@/components/admin/admin-quote-history-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import {
  filterAdminQuoteHistoryGroups,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminActiveRequestsQuoteHistoryPage({
  searchParams,
}: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const result = await loadAdminItemRequestsPagePayload();
  const merchantEstimateFees = await getMerchantPricingForEstimates();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const { quoteHistoryGroups, snapshotsByRequestId } = result.payload;

  const quoteHistoryRequestIds = quoteHistoryGroups.flatMap((g) =>
    g.lines.map((line) => line.request.id),
  );
  const orderContextByRequestId = await getOrderContextByItemRequestIds(
    quoteHistoryRequestIds,
  );

  return (
    <AdminQuoteHistoryGroupedTable
      groups={filterAdminQuoteHistoryGroups(quoteHistoryGroups, clerkUserId)}
      snapshotsByRequestId={snapshotsByRequestId}
      orderContextByRequestId={Object.fromEntries(orderContextByRequestId)}
      merchantEstimateFees={merchantEstimateFees}
    />
  );
}
