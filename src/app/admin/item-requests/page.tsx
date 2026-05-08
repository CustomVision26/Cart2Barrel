import { AdminItemRequestsTabs } from "@/components/admin/admin-item-requests-tabs";
import { listItemRequestsWithProfileForAdmin } from "@/data/admin-item-requests";
import { listQuoteHistoryGroupedForAdmin } from "@/data/admin-quote-history";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { buildAdminItemRequestGroups } from "@/lib/admin-item-requests-group";
import { safeCurrentUser } from "@/lib/safe-current-user";

export default async function AdminItemRequestsPage() {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Item requests
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }
  const user = cu.user;
  const admin = isClerkAdmin(user);
  const rows = await listItemRequestsWithProfileForAdmin(user);
  const groups = buildAdminItemRequestGroups(rows);
  const quoteHistoryGroups = await listQuoteHistoryGroupedForAdmin(user);
  const requestIds = new Set<string>();
  for (const row of rows) requestIds.add(row.request.id);
  for (const g of quoteHistoryGroups) {
    for (const line of g.lines) {
      requestIds.add(line.request.id);
    }
  }
  const snapshotRows = await listItemRequestLineSnapshotsByRequestIds(user, [
    ...requestIds,
  ]);
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows)
  );
  const hasActiveQueue = groups.some((g) => g.activeQueueCount > 0);

  const emptyAsNonAdmin = !admin;
  const noData =
    emptyAsNonAdmin ||
    (rows.length === 0 && quoteHistoryGroups.length === 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Item requests
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Active requests</span>{" "}
          groups each account’s <span className="font-medium text-foreground">queue</span>:{" "}
          new submissions, customer resends (request new estimate), and quoted lines awaiting
          acceptance.{" "}
          <span className="font-medium text-foreground">Quote history</span> lists staff
          estimate revisions; voided quotes from customer resends stay off this tab.
        </p>
      </div>

      {noData ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyAsNonAdmin
            ? "You do not have admin access."
            : "No item requests or quotes yet."}
        </p>
      ) : (
        <AdminItemRequestsTabs
          groups={groups}
          quoteHistoryGroups={quoteHistoryGroups}
          hasActiveQueue={hasActiveQueue}
          snapshotsByRequestId={snapshotsByRequestId}
        />
      )}
    </div>
  );
}
