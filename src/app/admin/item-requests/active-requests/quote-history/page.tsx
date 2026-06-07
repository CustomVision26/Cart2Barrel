import { AdminQuoteHistoryGroupedTable } from "@/components/admin/admin-quote-history-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import { listItemQuotesByRequestIds } from "@/data/item-quotes";
import {
  groupReturnRequestsByItemRequestId,
  listOutsidePurchaseReturnRequestsByItemRequestIds,
} from "@/data/outside-purchase-return-requests";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import type { BatchQuoteEstimate, ItemQuote } from "@/db/schema";
import {
  filterAdminQuoteHistoryGroups,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";
import {
  computeBatchLineShares,
  type BatchLineShare,
} from "@/lib/batch-line-share";

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

  const {
    quoteHistoryGroups,
    snapshotsByRequestId,
    batchQuoteHistoryBundles,
    batchQuoteHistoryLatestQuotesByRequestId,
  } = result.payload;

  // Per-product share of each saved batch estimate, so the audit preview can
  // show this line's slice of the batch (matches the customer/admin batch UIs).
  const batchShareByRequestId: Record<string, BatchLineShare> = {};
  const batchEstimateNoteByRequestId: Record<string, string> = {};
  const batchNumberByRequestId: Record<string, string> = {};
  const batchEstimateByRequestId: Record<string, BatchQuoteEstimate> = {};
  for (const bundle of batchQuoteHistoryBundles) {
    if (!bundle.latestEstimate) continue;
    const lineIds = bundle.requests.map((r) => r.id);
    const shares = computeBatchLineShares(
      bundle.latestEstimate,
      lineIds,
      (id) => batchQuoteHistoryLatestQuotesByRequestId[id] ?? null,
    );
    const batchNote = bundle.latestEstimate.staffNote?.trim() ?? "";
    for (const [id, share] of shares) {
      batchShareByRequestId[id] = share;
      batchNumberByRequestId[id] = bundle.session.batchNumber;
      batchEstimateByRequestId[id] = bundle.latestEstimate;
      if (batchNote) batchEstimateNoteByRequestId[id] = batchNote;
    }
  }

  const quoteHistoryRequestIds = quoteHistoryGroups.flatMap((g) =>
    g.lines.map((line) => line.request.id),
  );
  const [orderContextByRequestId, allQuotes, returnRows] = await Promise.all([
    getOrderContextByItemRequestIds(quoteHistoryRequestIds),
    listItemQuotesByRequestIds(quoteHistoryRequestIds),
    listOutsidePurchaseReturnRequestsByItemRequestIds(quoteHistoryRequestIds),
  ]);
  const returnRequestsByItemRequestId =
    groupReturnRequestsByItemRequestId(returnRows);

  const quotesByRequestId: Record<string, ItemQuote[]> = {};
  for (const quote of allQuotes) {
    (quotesByRequestId[quote.itemRequestId] ??= []).push(quote);
  }

  return (
    <AdminQuoteHistoryGroupedTable
      groups={filterAdminQuoteHistoryGroups(quoteHistoryGroups, clerkUserId)}
      snapshotsByRequestId={snapshotsByRequestId}
      returnRequestsByItemRequestId={returnRequestsByItemRequestId}
      quotesByRequestId={quotesByRequestId}
      batchShareByRequestId={batchShareByRequestId}
      batchEstimateNoteByRequestId={batchEstimateNoteByRequestId}
      batchNumberByRequestId={batchNumberByRequestId}
      batchEstimateByRequestId={batchEstimateByRequestId}
      orderContextByRequestId={Object.fromEntries(orderContextByRequestId)}
      merchantEstimateFees={merchantEstimateFees}
    />
  );
}
