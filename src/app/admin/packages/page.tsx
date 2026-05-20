import { AdminWarehouseReceivingSection } from "@/components/admin/admin-warehouse-receiving-section";
import { AdminPackagesListControls } from "@/components/admin/admin-packages-list-controls";
import {
  listAdminPackagesQueuePage,
  type PurchaseQueueLineRow,
} from "@/data/admin-purchase-queue";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { purchaseQueueRowToWarehouseReceivingLine } from "@/lib/admin-package-receiving-line";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseAdminListQuery } from "@/lib/admin-customer-filter";
import { safeCurrentUser } from "@/lib/safe-current-user";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage({ searchParams }: PageProps) {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Packages
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }

  const admin = isClerkAdmin(cu.user);
  const rawSp = (await searchParams) ?? {};
  const query = parseAdminListQuery(rawSp);

  const pagePack =
    !admin ?
      {
        rows: [] as PurchaseQueueLineRow[],
        totalLines: 0,
        page: 1,
        totalPages: 1,
        pageSize: query.ps,
        query,
      }
    : await listAdminPackagesQueuePage(query);

  const snapshotRows =
    admin && pagePack.rows.length > 0 ?
      await listItemRequestLineSnapshotsByRequestIds(
        cu.user,
        [...new Set(pagePack.rows.map((row) => row.request.id))],
      )
    : [];
  const snapshotsByRequestId = groupItemRequestLineSnapshotsByRequestId(
    snapshotRows,
  );

  const lines = pagePack.rows.map((row) =>
    purchaseQueueRowToWarehouseReceivingLine(
      row,
      snapshotsByRequestId.get(row.request.id),
    ),
  );
  const hasActiveSearch = query.q.trim().length > 0;
  const emptyQueue = admin && pagePack.totalLines === 0 && !hasActiveSearch;
  const noSearchHits = admin && pagePack.totalLines === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Packages
        </h1>
        <p className="text-sm text-muted-foreground">
          All paid package lines on the barrel pipeline: awaiting barrel (good, damaged accepted,
          or wrong item accepted) and already assigned in-container (
          <span className="font-medium text-foreground">In barrel: awaiting shipping</span>
          ). {pagePack.totalLines} matching package line
          {pagePack.totalLines === 1 ? "" : "s"}. Use the control center to filter by customer,
          product, order, request, or batch.
        </p>
      </div>
      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <>
          <AdminPackagesListControls
            key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
            query={pagePack.query}
            totalLines={pagePack.totalLines}
            page={pagePack.page}
            totalPages={pagePack.totalPages}
            pageSize={pagePack.pageSize}
          />
          {emptyQueue ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No packages are awaiting barrel or consolidation yet. Lines appear here after
              warehouse receipt from Purchase orders, including customer-accepted damaged or
              wrong-item deliveries.
            </p>
          : null}
          {noSearchHits ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No packages match your filter. Try customer name or email, product wording, order id,
              request id, batch number, or batch session id.
            </p>
          : null}
          {!emptyQueue && !noSearchHits ?
            <AdminWarehouseReceivingSection
              key={`${query.page}-${query.ps}-${query.sort}-${query.q}`}
              lines={lines}
            />
          : null}
        </>
      )}
    </div>
  );
}
