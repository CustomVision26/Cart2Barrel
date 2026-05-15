import { redirect } from "next/navigation";

import { AdminBatchItemsTable } from "@/components/admin/admin-batch-items-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";
import { listSubmittedBatchSessionsForAdminPage } from "@/data/batch-quote-sessions";
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
  const query = parseAdminSubmittedBatchListQuery(sp);
  const { bundles, totalCount } =
    await listSubmittedBatchSessionsForAdminPage(query);
  const queueTotalCount = result.payload.submittedBatchBundles.length;

  const maxPage = Math.max(1, Math.ceil(totalCount / query.pageSize));

  if (totalCount === 0 && query.page > 1) {
    redirect(adminSubmittedBatchListHrefMerge(query, { page: 1 }));
  }

  if (totalCount > 0 && query.page > maxPage) {
    redirect(adminSubmittedBatchListHrefMerge(query, { page: maxPage }));
  }

  return (
    <AdminBatchItemsTable
      bundles={bundles}
      listQuery={query}
      totalCount={totalCount}
      queueTotalCount={queueTotalCount}
    />
  );
}
