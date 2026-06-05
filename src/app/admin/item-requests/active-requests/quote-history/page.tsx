import { AdminQuoteHistoryGroupedTable } from "@/components/admin/admin-quote-history-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import { listItemQuotesByRequestIds } from "@/data/item-quotes";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import type { ItemQuote } from "@/db/schema";
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
  const [orderContextByRequestId, allQuotes] = await Promise.all([
    getOrderContextByItemRequestIds(quoteHistoryRequestIds),
    listItemQuotesByRequestIds(quoteHistoryRequestIds),
  ]);

  const quotesByRequestId: Record<string, ItemQuote[]> = {};
  for (const quote of allQuotes) {
    (quotesByRequestId[quote.itemRequestId] ??= []).push(quote);
  }

  return (
    <AdminQuoteHistoryGroupedTable
      groups={filterAdminQuoteHistoryGroups(quoteHistoryGroups, clerkUserId)}
      snapshotsByRequestId={snapshotsByRequestId}
      quotesByRequestId={quotesByRequestId}
      orderContextByRequestId={Object.fromEntries(orderContextByRequestId)}
      merchantEstimateFees={merchantEstimateFees}
    />
  );
}
