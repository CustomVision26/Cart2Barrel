import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { DashboardOrderHistoryTimeline } from "@/components/dashboard/dashboard-order-history-timeline";
import { DashboardOrdersCarouselView } from "@/components/dashboard/dashboard-orders-carousel-view";
import { DashboardOrdersListControls } from "@/components/dashboard/dashboard-orders-list-controls";
import { DashboardOrdersTabNav } from "@/components/dashboard/dashboard-orders-tab-nav";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsForOwnerByRequestIds,
} from "@/data/item-request-line-snapshots";
import {
  listDashboardPaidOrderHistoryLinesPage,
  listDashboardPaidOrderLinesPage,
} from "@/data/dashboard-order-lines";
import { orderSlideLaneNamesList } from "@/lib/admin-orders-slide-filters";
import { parsePaidOrdersQuery } from "@/lib/paid-orders-list-params";

type DashboardOrdersViewMode = "orders" | "history";

type DashboardOrdersViewProps = {
  mode: DashboardOrdersViewMode;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const viewCopy = {
  orders: {
    title: "Orders",
    basePath: "/dashboard/orders",
    description: (
      <>
        Browse paid checkouts in horizontal lanes —{" "}
        <span className="font-medium text-foreground">
          {orderSlideLaneNamesList()}
        </span>{" "}
        — with a product preview on each card. Double-click a card to open the full table grouped
        by batch and single items. Tracking and fulfillment actions are in that table.
      </>
    ),
    empty:
      "No paid orders yet. Complete checkout from your cart to see lines here while staff prepares your purchase.",
  },
  history: {
    title: "Order History",
    basePath: "/dashboard/orders-history",
    description: (
      <>
        Product-by-product records from cart checkout onward. Each card keeps the stored status
        trail for checkout, company purchase, warehouse receipt, returns, refunds, and the current
        fulfillment state.
      </>
    ),
    empty: "No paid order history yet. Completed checkouts will appear here.",
  },
} as const;

export async function DashboardOrdersView({
  mode,
  searchParams,
}: DashboardOrdersViewProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const copy = viewCopy[mode];
  const rawSp = (await searchParams) ?? {};
  const query = parsePaidOrdersQuery(rawSp);
  const pagePack =
    mode === "history"
      ? await listDashboardPaidOrderHistoryLinesPage(userId, query)
      : await listDashboardPaidOrderLinesPage(userId, query);

  const snapshotRows =
    pagePack.rows.length > 0 ?
      await listItemRequestLineSnapshotsForOwnerByRequestIds(
        userId,
        [...new Set(pagePack.rows.map((row) => row.request.id))],
      )
    : [];
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows),
  );

  const hasActiveSearch = query.q.trim().length > 0;
  const noOrdersAtAll = pagePack.totalOrders === 0 && !hasActiveSearch;
  const noSearchHits = pagePack.totalOrders === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <DashboardOrdersTabNav activeTab={mode} />

      <DashboardOrdersListControls
        key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
        basePath={copy.basePath}
        query={pagePack.query}
        totalOrders={pagePack.totalOrders}
        page={pagePack.page}
        totalPages={pagePack.totalPages}
        pageSize={pagePack.pageSize}
      />

      {noOrdersAtAll ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      : null}

      {noSearchHits ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No orders match your search. Try batch number, order UUID, request or line UUID, Stripe
          reference, note text, or product wording.
        </p>
      : null}

      {!noOrdersAtAll && !noSearchHits ?
        mode === "history" ?
          <DashboardOrderHistoryTimeline
            rows={pagePack.rows}
            snapshotsByRequestId={snapshotsByRequestId}
          />
        : (
          <DashboardOrdersCarouselView
            rows={pagePack.rows}
            snapshotsByRequestId={snapshotsByRequestId}
          />
        )
      : null}
    </div>
  );
}
