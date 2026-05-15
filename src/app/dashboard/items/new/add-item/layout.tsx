import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { AddItemShell } from "@/components/dashboard/add-item-shell";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsForOwnerByRequestIds,
} from "@/data/item-request-line-snapshots";
import { listBatchSessionsWithDetailsForOwner } from "@/data/batch-quote-sessions";
import {
  listActiveItemRequestsForUser,
  listProductHistoryForUser,
} from "@/data/item-requests";
import { listItemQuotesForOwnerByRequestIds } from "@/data/item-quotes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import { fulfillmentProductHistoryLabelFromSnapshots } from "@/lib/product-history-fulfillment";
import { safeCurrentUser } from "@/lib/safe-current-user";

export default async function DashboardAddItemLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const cu = await safeCurrentUser();
  const customerName =
    cu.ok && cu.user?.fullName?.trim()
      ? cu.user.fullName.trim()
      : cu.ok && cu.user?.primaryEmailAddress?.emailAddress?.trim()
        ? cu.user.primaryEmailAddress.emailAddress.trim()
        : "Customer";
  const customerEmail =
    cu.ok && cu.user?.primaryEmailAddress?.emailAddress?.trim()
      ? cu.user.primaryEmailAddress.emailAddress.trim()
      : null;

  const activeRequests = await listActiveItemRequestsForUser(userId);
  const historyRequests = await listProductHistoryForUser(userId);
  const batchBundles = await listBatchSessionsWithDetailsForOwner(userId);

  const batchRequestIds = batchBundles.flatMap((b) => b.requests.map((r) => r.id));
  const snapshotRequestIds = [
    ...new Set([
      ...activeRequests.map((r) => r.id),
      ...historyRequests.map((r) => r.id),
      ...batchRequestIds,
    ]),
  ];
  const snapshotRows = await listItemRequestLineSnapshotsForOwnerByRequestIds(
    userId,
    snapshotRequestIds
  );
  const snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]> =
    Object.fromEntries(groupItemRequestLineSnapshotsByRequestId(snapshotRows));
  const quoteRows = await listItemQuotesForOwnerByRequestIds(
    userId,
    snapshotRequestIds
  );
  const quotesByRequestId = Object.fromEntries(
    snapshotRequestIds.map((id) => [
      id,
      quoteRows.filter((quote) => quote.itemRequestId === id),
    ])
  );

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
            href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Requested items
          </Link>
          .
        </p>
      </div>

      <AddItemShell
        payload={{
          customer: {
            name: customerName,
            email: customerEmail,
          },
          activeRequests,
          historyRequests,
          batchBundles,
          snapshotsByRequestId,
          quotesByRequestId,
          fulfillmentLabelByRequestId,
        }}
      >
        {children}
      </AddItemShell>
    </div>
  );
}
