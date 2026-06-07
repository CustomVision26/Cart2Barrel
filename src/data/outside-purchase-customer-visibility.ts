import { and, eq } from "drizzle-orm";

import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsForOwnerByRequestIds,
} from "@/data/item-request-line-snapshots";
import { insertOutsidePurchaseLifecycleSnapshot } from "@/data/outside-purchase-lifecycle-snapshot";
import { getItemRequestById } from "@/data/item-requests";
import {
  restoreLatestVoidedOperationalQuoteForItemRequest,
} from "@/data/item-quotes";
import { getDb } from "@/db";
import { itemRequests, type ItemRequest } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  outsidePurchaseHadBeenOnCustomerActiveBefore,
  outsidePurchaseNeedsCustomerVisibilityRepair,
} from "@/lib/outside-purchase-published";
import {
  ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION,
  ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK,
} from "@/lib/item-quote-void-reason";

/** Restore publish timestamp so a reinstated outside purchase appears on Active. */
export async function republishOutsidePurchaseForCustomerActive(params: {
  clerkUserId: string;
  itemRequestId: string;
  auditMemo: string;
}): Promise<string | null> {
  const row = await getItemRequestById(params.itemRequestId);
  if (
    !row ||
    row.clerkUserId !== params.clerkUserId ||
    !isOutsidePurchaseRequest(row) ||
    row.outsidePurchasePublishedAt
  ) {
    return null;
  }

  const publishedAt = new Date().toISOString();
  const db = getDb();
  await db
    .update(itemRequests)
    .set({ outsidePurchasePublishedAt: publishedAt })
    .where(
      and(
        eq(itemRequests.id, params.itemRequestId),
        eq(itemRequests.clerkUserId, params.clerkUserId),
      ),
    );

  const updated = await getItemRequestById(params.itemRequestId);
  if (updated) {
    await insertOutsidePurchaseLifecycleSnapshot({
      request: updated,
      phase: "outside_purchase_published",
      auditMemo: params.auditMemo,
    });
  }

  return publishedAt;
}

/** Reinstated outside purchases can remain `pending` when the voided quote was not restored. */
async function repairOutsidePurchaseToQuotedStatus(
  clerkUserId: string,
  itemRequestId: string,
): Promise<boolean> {
  await restoreLatestVoidedOperationalQuoteForItemRequest(itemRequestId, [
    ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION,
    ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK,
  ]);

  const db = getDb();
  const updated = await db
    .update(itemRequests)
    .set({ status: "quoted" })
    .where(
      and(
        eq(itemRequests.id, itemRequestId),
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "pending"),
      ),
    )
    .returning({ id: itemRequests.id });

  return updated.length > 0;
}

/**
 * Repairs quoted outside purchases on Active load (status / publish timestamp).
 * Does not override a staff withdraw — latest `outside_purchase_unpublished`
 * snapshot must keep the line hidden from the customer.
 */
export async function repairOutsidePurchaseActiveVisibility(
  clerkUserId: string,
  rows: ItemRequest[],
): Promise<ItemRequest[]> {
  const outsidePurchaseRows = rows.filter((row) => isOutsidePurchaseRequest(row));
  if (outsidePurchaseRows.length === 0) {
    return rows;
  }

  const snapshotRows = await listItemRequestLineSnapshotsForOwnerByRequestIds(
    clerkUserId,
    outsidePurchaseRows.map((row) => row.id),
  );
  const snapshotsByRequestId = groupItemRequestLineSnapshotsByRequestId(
    snapshotRows,
  );

  const statusById = new Map<string, ItemRequest["status"]>();
  const publishedAtById = new Map<string, string>();

  for (const row of outsidePurchaseRows) {
    const snapshots = snapshotsByRequestId.get(row.id) ?? [];
    const hadCustomerActive = outsidePurchaseHadBeenOnCustomerActiveBefore(snapshots);

    if (
      row.status === "pending" &&
      (hadCustomerActive || row.outsidePurchaseReference?.trim())
    ) {
      const repaired = await repairOutsidePurchaseToQuotedStatus(
        clerkUserId,
        row.id,
      );
      if (repaired) {
        statusById.set(row.id, "quoted");
      }
    }

    if (
      row.outsidePurchasePublishedAt == null &&
      outsidePurchaseNeedsCustomerVisibilityRepair(snapshots)
    ) {
      const publishedAt = await republishOutsidePurchaseForCustomerActive({
        clerkUserId,
        itemRequestId: row.id,
        auditMemo:
          "Republished so this outside purchase appears on the customer's Active products tab.",
      });
      if (publishedAt) {
        publishedAtById.set(row.id, publishedAt);
      }
    }
  }

  if (statusById.size === 0 && publishedAtById.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    const status = statusById.get(row.id);
    const publishedAt = publishedAtById.get(row.id);
    if (!status && !publishedAt) {
      return row;
    }
    return {
      ...row,
      ...(status ? { status } : {}),
      ...(publishedAt ? { outsidePurchasePublishedAt: publishedAt } : {}),
    };
  });
}
