import { AdminItemRequestsGroupedTable } from "@/components/admin/admin-item-requests-grouped-table";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminItemRequestsQueuePage() {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return null;
  }

  const {
    payload: { groups, hasActiveQueue, snapshotsByRequestId },
  } = result;

  const queueGroups = groups.filter((g) => g.activeQueueCount > 0);

  if (hasActiveQueue) {
    return (
      <AdminItemRequestsGroupedTable
        groups={queueGroups}
        snapshotsByRequestId={snapshotsByRequestId}
      />
    );
  }

  return (
    <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      Nothing in the active queue right now (no pending, resend, or quoted items).
    </p>
  );
}
