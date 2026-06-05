import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { getItemRequestById } from "@/data/item-requests";
import { insertItemRequestLineSnapshot, lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { itemRequests } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { parseOutsidePurchaseReceivedCondition } from "@/lib/outside-purchase-display";

/**
 * Customer toggles the resolution flag on their own `missing` outside-purchase
 * line. Scoped to the Clerk owner and only valid while the line is a quoted
 * outside purchase received as `missing`.
 */
export async function setOutsidePurchaseMissingResolutionForOwner(params: {
  clerkUserId: string;
  itemRequestId: string;
  resolved: boolean;
}): Promise<boolean> {
  const { clerkUserId, itemRequestId, resolved } = params;

  const row = await getItemRequestById(itemRequestId);
  if (!row || row.clerkUserId !== clerkUserId) {
    throw new Error("Product could not be found.");
  }
  if (
    !isOutsidePurchaseRequest(row) ||
    row.status !== "quoted" ||
    parseOutsidePurchaseReceivedCondition(row.outsidePurchaseReceivedCondition) !==
      "missing"
  ) {
    throw new Error("This product can no longer be updated.");
  }

  const db = getDb();
  const updated = await db
    .update(itemRequests)
    .set({
      outsidePurchaseMissingResolvedAt: resolved ? sql`now()` : null,
    })
    .where(
      and(
        eq(itemRequests.id, itemRequestId),
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "quoted"),
      ),
    )
    .returning({ id: itemRequests.id });

  if (updated.length === 0) return false;

  const after = await getItemRequestById(itemRequestId);
  if (after) {
    await insertItemRequestLineSnapshot({
      itemRequestId,
      phase: "customer_line_edit",
      auditMemo:
        resolved ?
          "Customer marked the missing outside purchase as resolved (Missing item : resolved)."
        : "Customer reopened the missing outside purchase (marked unresolved).",
      line: lineSnapshotPayloadFromItemRequest(after),
    });
  }

  return true;
}
