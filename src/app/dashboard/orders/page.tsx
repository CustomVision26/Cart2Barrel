import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { DashboardPaidOrdersTable } from "@/components/dashboard/dashboard-paid-orders-table";
import { listDashboardPaidOrderLinesForOwner } from "@/data/dashboard-order-lines";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsForOwnerByRequestIds,
} from "@/data/item-request-line-snapshots";

export default async function DashboardOrdersPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const rows = await listDashboardPaidOrderLinesForOwner(userId);
  const snapshotRows = await listItemRequestLineSnapshotsForOwnerByRequestIds(
    userId,
    [...new Set(rows.map((row) => row.request.id))]
  );
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows)
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Orders
        </h1>
        <p className="text-sm text-muted-foreground">
          Lines from completed checkouts. Status updates when staff confirms they purchased your
          items from the retailer and when delivery moves forward.
        </p>
      </div>

      <DashboardPaidOrdersTable
        rows={rows}
        snapshotsByRequestId={snapshotsByRequestId}
      />
    </div>
  );
}
