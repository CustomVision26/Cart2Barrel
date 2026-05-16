import { AdminOrderHistoryTimeline } from "@/components/admin/admin-order-history-timeline";
import { AdminOrdersListControls } from "@/components/admin/admin-orders-list-controls";
import { AdminOrdersTabNav } from "@/components/admin/admin-orders-tab-nav";
import { listAdminPaidOrderHistoryLinesPage } from "@/data/admin-order-lines";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { listOrderContainerItemsByOrderIds } from "@/data/order-container-admin";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parsePaidOrdersQuery } from "@/lib/paid-orders-list-params";
import { safeCurrentUser } from "@/lib/safe-current-user";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersHistoryPage({ searchParams }: PageProps) {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Order History
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }

  const admin = isClerkAdmin(cu.user);
  const rawSp = (await searchParams) ?? {};
  const query = parsePaidOrdersQuery(rawSp);

  const pagePack = !admin
    ? {
        rows: [],
        totalOrders: 0,
        page: 1,
        totalPages: 1,
        pageSize: query.ps,
        query,
      }
    : await listAdminPaidOrderHistoryLinesPage(cu.user, query);

  const snapshotRows =
    admin && pagePack.rows.length > 0
      ? await listItemRequestLineSnapshotsByRequestIds(
          cu.user,
          [...new Set(pagePack.rows.map((row) => row.request.id))],
        )
      : [];
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows),
  );

  const orderIdsOnPage =
    admin && pagePack.rows.length > 0
      ? [...new Set(pagePack.rows.map((row) => row.order.id))]
      : [];
  const orderContainerLinesByOrderId =
    admin && orderIdsOnPage.length > 0
      ? Object.fromEntries(await listOrderContainerItemsByOrderIds(orderIdsOnPage))
      : {};

  const hasActiveSearch = query.q.trim().length > 0;
  const noHistoryAtAll = admin && pagePack.totalOrders === 0 && !hasActiveSearch;
  const noSearchHits = admin && pagePack.totalOrders === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Order History
        </h1>
        <p className="text-sm text-muted-foreground">
          Product-level inventory history for every paid checkout. Batch and single
          products are grouped by customer, order, and batch so staff can track each
          fulfillment update after cart checkout through purchase, receiving, returns,
          refunds, barrel staging, and shipment handoff.
        </p>
      </div>

      <AdminOrdersTabNav activeTab="history" />

      {!admin ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      ) : (
        <>
          <AdminOrdersListControls
            key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
            query={pagePack.query}
            totalOrders={pagePack.totalOrders}
            page={pagePack.page}
            totalPages={pagePack.totalPages}
            pageSize={pagePack.pageSize}
            basePath="/admin/orders-history"
          />
          {noHistoryAtAll ? (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No paid checkout history has been recorded yet.
            </p>
          ) : null}
          {noSearchHits ? (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No order history records match your lookup. Try customer name or email,
              batch number, order id, product wording, request id, order line id, or
              Stripe payment reference.
            </p>
          ) : null}
          {!noHistoryAtAll && !noSearchHits ? (
            <AdminOrderHistoryTimeline
              rows={pagePack.rows}
              snapshotsByRequestId={snapshotsByRequestId}
              orderContainerLinesByOrderId={orderContainerLinesByOrderId}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
