import { AdminPaidOrdersTable } from "@/components/admin/admin-paid-orders-table";
import { listAdminPaidOrderLines } from "@/data/admin-order-lines";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export default async function AdminOrdersPage() {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Orders
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }

  const admin = isClerkAdmin(cu.user);
  const rows = await listAdminPaidOrderLines(cu.user);
  const snapshotRows = await listItemRequestLineSnapshotsByRequestIds(cu.user, [
    ...new Set(rows.map((row) => row.request.id)),
  ]);
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
          Paid checkout lines appear here with fulfillment status. Use{" "}
          <span className="font-medium text-foreground">Purchase</span> after your team buys the product from the retailer.
          Then use{" "}
          <span className="font-medium text-foreground">Request delivery</span> to save a delivery record and send emails to operations and (by default) the customer.
        </p>
      </div>

      {!admin ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      ) : (
        <AdminPaidOrdersTable
          rows={rows}
          snapshotsByRequestId={snapshotsByRequestId}
        />
      )}
    </div>
  );
}
