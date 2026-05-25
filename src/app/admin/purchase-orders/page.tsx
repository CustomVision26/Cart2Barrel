import Link from "next/link";

import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import { AdminPurchaseOrdersTable } from "@/components/admin/admin-purchase-orders-table";
import { AdminPurchaseQueueListControls } from "@/components/admin/admin-purchase-queue-list-controls";
import {
  AdminNestedPanelFocusProvider,
  AdminParentControlsShell,
} from "@/components/admin/admin-nested-panel-focus-context";
import { listAdminPurchaseQueuePage } from "@/data/admin-purchase-queue";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseAdminListQuery } from "@/lib/admin-customer-filter";
import { PRODUCT_RETURN_AWAITING_REFUND_LABEL } from "@/lib/product-return-request-labels";
import { safeCurrentUser } from "@/lib/safe-current-user";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminPurchaseOrdersPage({ searchParams }: PageProps) {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Purchase orders
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
        rows: [],
        totalLines: 0,
        page: 1,
        totalPages: 1,
        pageSize: query.ps,
        query,
      }
    : await listAdminPurchaseQueuePage(query);

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

  const staffProfilesByClerkUserId =
    admin && pagePack.rows.length > 0 ?
      await loadAdminStaffProfilesByClerkUserIds(
        pagePack.rows.map((row) => resolveOrderLineUpdatedByClerkUserId(row.orderItem)),
      )
    : {};

  const hasActiveSearch = query.q.trim().length > 0;
  const emptyQueue = admin && pagePack.totalLines === 0 && !hasActiveSearch;
  const noSearchHits = admin && pagePack.totalLines === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <AdminPageTitleWithHelp
        title="Purchase orders"
        tooltipClassName="w-[28rem]"
        help={
          <>
          Inbound coordination and receipt logging for lines on this queue: pending delivery, non-good
          receipts, problem receipts you are correcting, replacement returns in transit (
          <span className="font-medium text-foreground">returned:awaiting delivery</span>), and
          money-back returns (
          <span className="font-medium text-foreground">{PRODUCT_RETURN_AWAITING_REFUND_LABEL}</span>
          ) after staff save return tracking. When{" "}
          <span className="font-medium text-foreground">Received delivery</span> records condition{" "}
          <span className="font-medium text-foreground">Good</span>, fulfillment becomes{" "}
          <span className="font-medium text-foreground">
            Delivery received: good - awaiting barrel
          </span>
          — that line{" "}
          <span className="font-medium text-foreground">moves off this table</span> to{" "}
          <Link
            href="/admin/packages"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Packages
          </Link>{" "}
          for warehouse receiving. Shoppers see the same status on{" "}
          <Link
            href="/dashboard/orders"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Dashboard → Orders
          </Link>
          ; staff can review receipt snapshots in each row’s{" "}
          <span className="font-medium text-foreground">Request line audit</span>. Use{" "}
          <span className="font-medium text-foreground">Open tracking</span> when a shipment URL exists,{" "}
          <span className="font-medium text-foreground">Tracking product</span> to edit inbound link /
          carrier / number (or{" "}
          <span className="font-medium text-foreground">Return product</span> when a receipt needs
          correction and you are logging return shipment tracking. Replacement returns remain here until
          receipt is logged; money-back lines stay here for{" "}
          <span className="font-medium text-foreground">Refund line</span> once return tracking is saved.
          Purchase
          approval still starts from <span className="font-medium text-foreground">Orders</span> →{" "}
          <span className="font-medium text-foreground">Review and approve</span>.
          </>
        }
      />

      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <>
          <AdminNestedPanelFocusProvider>
            <AdminParentControlsShell>
              <AdminPurchaseQueueListControls
                key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
                query={pagePack.query}
                totalLines={pagePack.totalLines}
                page={pagePack.page}
                totalPages={pagePack.totalPages}
                pageSize={pagePack.pageSize}
              />
            </AdminParentControlsShell>
          {emptyQueue ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing is coordinating delivery or awaiting receipt correction after a recorded purchase yet.
            </p>
          : null}
          {noSearchHits ?
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No lines match your search. Try batch number or session UUID, order or request id,
              customer email or name, or product wording — same rules as Orders.
            </p>
          : null}
          {!emptyQueue && !noSearchHits ?
            <AdminPurchaseOrdersTable
              rows={pagePack.rows}
              snapshotsByRequestId={snapshotsByRequestId}
              staffProfilesByClerkUserId={staffProfilesByClerkUserId}
            />
          : null}
          </AdminNestedPanelFocusProvider>
        </>
      )}
    </div>
  );
}
