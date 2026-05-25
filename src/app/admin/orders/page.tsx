import { AdminOrdersCarouselView } from "@/components/admin/admin-orders-carousel-view";
import { AdminOrdersListControls } from "@/components/admin/admin-orders-list-controls";
import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import {
  AdminNestedPanelFocusProvider,
  AdminParentControlsShell,
} from "@/components/admin/admin-nested-panel-focus-context";
import { AdminOrdersTabNav } from "@/components/admin/admin-orders-tab-nav";
import { parseAdminListQuery } from "@/lib/admin-customer-filter";
import { listAdminPaidOrderLinesPage } from "@/data/admin-order-lines";
import {
  collectLatestQuotesForRequests,
  mapCheckoutBatchEstimatesBySessionIds,
} from "@/data/batch-quote-sessions";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { listOrderContainerItemsByOrderIds } from "@/data/order-container-admin";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  orderSlideLaneNamesList,
  ORDER_SLIDE_LANE_AUDIENCE,
} from "@/lib/admin-orders-slide-filters";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Orders</h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }

  const admin = isClerkAdmin(cu.user);
  const rawSp = (await searchParams) ?? {};
  const query = parseAdminListQuery(rawSp);

  const pagePack = !admin ?
    {
      rows: [],
      totalOrders: 0,
      page: 1,
      totalPages: 1,
      pageSize: query.ps,
      query,
    }
  : await listAdminPaidOrderLinesPage(cu.user, query);

  const snapshotRows =
    admin && pagePack.rows.length > 0 ?
      await listItemRequestLineSnapshotsByRequestIds(
        cu.user,
        [...new Set(pagePack.rows.map((row) => row.request.id))],
      )
    : [];
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows),
  );

  const requestIdsOnPage =
    admin && pagePack.rows.length > 0 ?
      [...new Set(pagePack.rows.map((row) => row.request.id))]
    : [];
  const latestQuotesByRequestId =
    admin && requestIdsOnPage.length > 0 ?
      Object.fromEntries(
        await collectLatestQuotesForRequests(requestIdsOnPage),
      )
    : {};

  const batchSessionIdsOnPage =
    admin && pagePack.rows.length > 0 ?
      [
        ...new Set(
          pagePack.rows
            .map((row) => row.resolvedBatchSessionId?.trim())
            .filter((id): id is string => Boolean(id)),
        ),
      ]
    : [];
  const batchEstimatesBySessionId =
    admin && batchSessionIdsOnPage.length > 0 ?
      Object.fromEntries(
        await mapCheckoutBatchEstimatesBySessionIds(batchSessionIdsOnPage),
      )
    : {};

  const orderIdsOnPage =
    admin && pagePack.rows.length > 0 ?
      [...new Set(pagePack.rows.map((row) => row.order.id))]
    : [];
  const orderContainerLinesByOrderId =
    admin && orderIdsOnPage.length > 0 ?
      Object.fromEntries(await listOrderContainerItemsByOrderIds(orderIdsOnPage))
    : {};

  const staffProfilesByClerkUserId =
    admin && pagePack.rows.length > 0 ?
      await loadAdminStaffProfilesByClerkUserIds(
        pagePack.rows.map((row) => resolveOrderLineUpdatedByClerkUserId(row.orderItem)),
      )
    : {};

  const hasActiveSearch = query.q.trim().length > 0;
  const noOrdersAtAll = admin && pagePack.totalOrders === 0 && !hasActiveSearch;
  const noSearchHits = admin && pagePack.totalOrders === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <AdminPageTitleWithHelp
        title="Orders"
        tooltipClassName="w-80"
        help={
          <>
            Orders appear in horizontal lanes below —{" "}
            <span className="font-medium text-foreground">
              {orderSlideLaneNamesList(ORDER_SLIDE_LANE_AUDIENCE)}
            </span>{" "}
            — newest first in each lane. Double-click a card to open the full table
            grouped by batch and single. Pagination counts orders across all lanes.
          </>
        }
      />

      <AdminOrdersTabNav activeTab="orders" />

      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <>
          <AdminNestedPanelFocusProvider>
            <AdminParentControlsShell>
              <AdminOrdersListControls
                key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
                query={pagePack.query}
                totalOrders={pagePack.totalOrders}
                page={pagePack.page}
                totalPages={pagePack.totalPages}
                pageSize={pagePack.pageSize}
              />
            </AdminParentControlsShell>
            {noOrdersAtAll ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No paid orders yet.
            </p>
          : null}
          {noSearchHits ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No orders match your search. Try batch number or session UUID, order or line UUID,
              Stripe payment-intent reference, customer email or name, buyer note text, or product wording.
            </p>
          : null}
          {!noOrdersAtAll && !noSearchHits ?
            <AdminOrdersCarouselView
              rows={pagePack.rows}
              snapshotsByRequestId={snapshotsByRequestId}
              latestQuotesByRequestId={latestQuotesByRequestId}
              batchEstimatesBySessionId={batchEstimatesBySessionId}
              orderContainerLinesByOrderId={orderContainerLinesByOrderId}
              staffProfilesByClerkUserId={staffProfilesByClerkUserId}
            />
          : null}
          </AdminNestedPanelFocusProvider>
        </>
      )}
    </div>
  );
}
