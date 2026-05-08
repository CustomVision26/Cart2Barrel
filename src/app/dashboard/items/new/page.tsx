import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { ItemsNewTabs } from "@/components/dashboard/items-new-tabs";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsForOwnerByRequestIds,
} from "@/data/item-request-line-snapshots";
import {
  listActiveItemRequestsForUser,
  listProductHistoryForUser,
} from "@/data/item-requests";
import { fulfillmentProductHistoryLabelFromSnapshots } from "@/lib/product-history-fulfillment";

export default async function DashboardNewItemPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const activeRequests = await listActiveItemRequestsForUser(userId);
  const historyRequests = await listProductHistoryForUser(userId);
  const snapshotRequestIds = [
    ...new Set([
      ...activeRequests.map((r) => r.id),
      ...historyRequests.map((r) => r.id),
    ]),
  ];
  const snapshotRows = await listItemRequestLineSnapshotsForOwnerByRequestIds(
    userId,
    snapshotRequestIds
  );
  const snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]> =
    Object.fromEntries(groupItemRequestLineSnapshotsByRequestId(snapshotRows));

  const fulfillmentLabelByRequestId: Record<string, string> = {};
  for (const r of historyRequests) {
    const snaps = snapshotsByRequestId[r.id] ?? [];
    const label = fulfillmentProductHistoryLabelFromSnapshots(snaps);
    if (label) fulfillmentLabelByRequestId[r.id] = label;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Add item
        </h1>
        <p className="text-sm text-muted-foreground">
          Track product requests and history. Submit new items from{" "}
          <Link
            href="/dashboard/items"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Requested items
          </Link>
          .
        </p>
      </div>

      <ItemsNewTabs
        activeRequests={activeRequests}
        historyRequests={historyRequests}
        snapshotsByRequestId={snapshotsByRequestId}
        fulfillmentLabelByRequestId={fulfillmentLabelByRequestId}
      />
    </div>
  );
}
