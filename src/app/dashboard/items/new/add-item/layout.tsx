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
import { getProfileByClerkId } from "@/data/profiles";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import {
  groupReturnRequestsByItemRequestId,
  listOutsidePurchaseReturnRequestsByItemRequestIds,
} from "@/data/outside-purchase-return-requests";
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import { fulfillmentProductHistoryLabelFromSnapshots } from "@/lib/product-history-fulfillment";

export default async function DashboardAddItemLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [profile, activeRequests, historyRequests, batchBundles] = await Promise.all([
    getProfileByClerkId(userId),
    listActiveItemRequestsForUser(userId),
    listProductHistoryForUser(userId),
    listBatchSessionsWithDetailsForOwner(userId),
  ]);

  const customerName =
    profile?.fullName?.trim() ||
    profile?.email?.trim() ||
    "Customer";
  const customerEmail = profile?.email?.trim() || null;

  const batchRequestIds = batchBundles.flatMap((b) => b.requests.map((r) => r.id));
  const snapshotRequestIds = [
    ...new Set([
      ...activeRequests.map((r) => r.id),
      ...historyRequests.map((r) => r.id),
      ...batchRequestIds,
    ]),
  ];

  const [snapshotRows, quoteRows, returnRequestRows, orderContextMap] =
    await Promise.all([
      listItemRequestLineSnapshotsForOwnerByRequestIds(userId, snapshotRequestIds),
      listItemQuotesForOwnerByRequestIds(userId, snapshotRequestIds),
      listOutsidePurchaseReturnRequestsByItemRequestIds(snapshotRequestIds),
      getOrderContextByItemRequestIds(snapshotRequestIds),
    ]);

  const snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]> =
    Object.fromEntries(groupItemRequestLineSnapshotsByRequestId(snapshotRows));
  const quotesByRequestId = Object.fromEntries(
    snapshotRequestIds.map((id) => [
      id,
      quoteRows.filter((quote) => quote.itemRequestId === id),
    ])
  );

  const returnRequestsByItemRequestId = groupReturnRequestsByItemRequestId(
    returnRequestRows,
  );

  const orderContextByRequestId = Object.fromEntries(orderContextMap);

  const fulfillmentLabelByRequestId: Record<string, string> = {};
  const allLabelRequests = [
    ...activeRequests,
    ...historyRequests,
    ...batchBundles.flatMap((bundle) => bundle.requests),
  ];
  const seenLabelRequestIds = new Set<string>();
  for (const r of allLabelRequests) {
    if (seenLabelRequestIds.has(r.id)) continue;
    seenLabelRequestIds.add(r.id);
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
          returnRequestsByItemRequestId,
          orderContextByRequestId,
        }}
      >
        {children}
      </AddItemShell>
    </div>
  );
}
