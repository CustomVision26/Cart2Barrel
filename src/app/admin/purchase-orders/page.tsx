import Link from "next/link";

import { AdminPurchaseOrdersTable } from "@/components/admin/admin-purchase-orders-table";
import { AdminPurchaseQueueListControls } from "@/components/admin/admin-purchase-queue-list-controls";
import { listAdminPurchaseQueuePage } from "@/data/admin-purchase-queue";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseAdminListQuery } from "@/lib/admin-customer-filter";
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

  const hasActiveSearch = query.q.trim().length > 0;
  const emptyQueue = admin && pagePack.totalLines === 0 && !hasActiveSearch;
  const noSearchHits = admin && pagePack.totalLines === 0 && hasActiveSearch;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Purchase orders
        </h1>
        <p className="text-sm text-muted-foreground">
          Inbound coordination and receipt logging for lines that belong on this queue (pending delivery,
          non-good receipts, and problem receipts you are correcting). They are listed here instead of{" "}
          <span className="font-medium text-foreground">Orders</span>. Lines in{" "}
          <span className="font-medium text-foreground">Product return: awaiting delivery</span> are
          managed under{" "}
          <Link
            href="/admin/orders"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Orders
          </Link>{" "}
          (shipment tracking and refunds). When{" "}
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
          correction and you are logging return shipment tracking — after return tracking is saved, follow-up
          moves to{" "}
          <Link
            href="/admin/orders"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Orders
          </Link>
          , and <span className="font-medium text-foreground">Refund</span> if needed. Purchase
          approval still starts from <span className="font-medium text-foreground">Orders</span> →{" "}
          <span className="font-medium text-foreground">Review and approve</span>.
        </p>
      </div>

      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <>
          <AdminPurchaseQueueListControls
            key={`${pagePack.query.sort}:${pagePack.query.page}:${pagePack.query.ps}:${pagePack.query.q}`}
            query={pagePack.query}
            totalLines={pagePack.totalLines}
            page={pagePack.page}
            totalPages={pagePack.totalPages}
            pageSize={pagePack.pageSize}
          />
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
            />
          : null}
        </>
      )}
    </div>
  );
}
