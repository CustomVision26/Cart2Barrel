import {
  AdminWarehouseReceivingSection,
  type WarehouseReceivingLine,
} from "@/components/admin/admin-warehouse-receiving-section";
import { AdminPackagesListControls } from "@/components/admin/admin-packages-list-controls";
import {
  listAdminPackagesQueuePage,
  type PurchaseQueueLineRow,
} from "@/data/admin-purchase-queue";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { parseAdminListQuery } from "@/lib/admin-customer-filter";
import { safeCurrentUser } from "@/lib/safe-current-user";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function toWarehouseReceivingLine(
  row: PurchaseQueueLineRow,
): WarehouseReceivingLine {
  const clerkUserId = row.order.clerkUserId;
  return {
    id: row.orderItem.id,
    itemLabel: `Order ${row.order.id.slice(0, 8)}… · Item ${row.orderItem.id.slice(0, 8)}…`,
    productName: row.request.productName?.trim() || "Unnamed product",
    orderedQty: row.orderItem.quantity,
    orderItem: row.orderItem,
    orderStatus: row.order.status,
    orderNumber: row.order.id,
    batchNumber: row.resolvedBatchNumber,
    batchSessionId: row.resolvedBatchSessionId,
    clerkUserId,
    customerGroupSortKey: adminCustomerSortKey({
      fullName: row.customerFullName,
      email: row.customerEmail,
      clerkUserId,
    }),
    customerDisplayLabel: adminCustomerDisplayLabel({
      fullName: row.customerFullName,
      email: row.customerEmail,
      clerkUserId,
    }),
    refundedCents: row.refundedCents,
    pendingRefundRequest: row.pendingRefundRequest,
  };
}

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

  const lines = pagePack.rows.map(toWarehouseReceivingLine);
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
          Warehouse receiving for paid order lines marked{" "}
          <span className="font-medium text-foreground">
            Delivery received: good - awaiting barrel
          </span>{" "}
          ({pagePack.totalLines} matching package line
          {pagePack.totalLines === 1 ? "" : "s"}). Use the control center to
          filter by customer, product, order, request, or batch, then sort the
          receiving workload for ecommerce operations.
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
              No packages are awaiting barrel or consolidation yet. Lines appear here after a
              delivery is received in good condition from Purchase orders.
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
