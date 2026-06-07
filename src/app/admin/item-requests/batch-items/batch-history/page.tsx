import { AdminBatchHistoryPanel } from "@/components/admin/admin-batch-history-panel";
import {
  collectLatestQuotesForRequests,
  listBatchHistoryOwnerBundlesForAdmin,
} from "@/data/batch-quote-sessions";
import type { ItemQuote } from "@/db/schema";
import {
  filterAdminBatchHistoryOwnerBundles,
  parseAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBatchItemsBatchHistoryPage({
  searchParams,
}: PageProps) {
  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const bundles = filterAdminBatchHistoryOwnerBundles(
    await listBatchHistoryOwnerBundlesForAdmin(),
    clerkUserId,
  );

  const requestIds = [
    ...new Set(bundles.flatMap((b) => b.requests.map((r) => r.id))),
  ];
  const latestQuotes = await collectLatestQuotesForRequests(requestIds);
  const quotesByRequestId: Record<string, ItemQuote[]> = {};
  for (const [id, quote] of latestQuotes) {
    quotesByRequestId[id] = [quote];
  }

  return (
    <AdminBatchHistoryPanel
      bundles={bundles}
      quotesByRequestId={quotesByRequestId}
    />
  );
}
