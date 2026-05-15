import { and, eq } from "drizzle-orm";

import { removeItemRequestsFromOwnerDraftBatchSession } from "@/data/batch-quote-sessions";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { voidActiveQuotesForItemRequest } from "@/data/item-quotes";
import { getItemRequestById } from "@/data/item-requests";
import { getDb } from "@/db";
import { batchQuoteSessions, itemRequests } from "@/db/schema";
import { ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION } from "@/lib/item-quote-void-reason";

/**
 * Moves owned pending / quoted rows to `withdrawn` (with quote void when quoted).
 * Detaches draft batch membership first when needed; rejects non-draft batch sessions.
 */
export async function withdrawCustomerActiveItemRequestsForOwner(params: {
  clerkUserId: string;
  itemRequestIds: string[];
}): Promise<{ withdrawnIds: string[] }> {
  const { clerkUserId } = params;
  const ids = [...new Set(params.itemRequestIds)];
  if (ids.length === 0) {
    throw new Error("Nothing to remove.");
  }

  const db = getDb();
  const withdrawnIds: string[] = [];

  for (const id of ids) {
    const row = await getItemRequestById(id);
    if (!row || row.clerkUserId !== clerkUserId) {
      throw new Error("One or more products could not be found.");
    }

    if (row.status !== "pending" && row.status !== "quoted") {
      throw new Error("Some selected lines can no longer be removed. Refresh and try again.");
    }

    const sid = row.batchQuoteSessionId;
    if (sid) {
      const [sess] = await db
        .select({ status: batchQuoteSessions.status })
        .from(batchQuoteSessions)
        .where(eq(batchQuoteSessions.id, sid))
        .limit(1);

      if (!sess) {
        await db
          .update(itemRequests)
          .set({ batchQuoteSessionId: null })
          .where(and(eq(itemRequests.id, id), eq(itemRequests.clerkUserId, clerkUserId)));
      } else if (sess.status === "draft") {
        await removeItemRequestsFromOwnerDraftBatchSession({
          clerkUserId,
          batchSessionId: sid,
          itemRequestIds: [id],
        });
      } else {
        throw new Error(
          "A selected product is bundled under Batch Quotes (submitted or quoted batch). Manage it on the Batch Quotes tab first."
        );
      }
    }

    let ready = await getItemRequestById(id);
    if (!ready || ready.clerkUserId !== clerkUserId) {
      throw new Error("Not found.");
    }

    if (ready.status === "quoted") {
      await voidActiveQuotesForItemRequest(
        id,
        ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION
      );
    }

    const updated = await db
      .update(itemRequests)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(itemRequests.id, id),
          eq(itemRequests.clerkUserId, clerkUserId),
          eq(itemRequests.status, ready.status)
        )
      )
      .returning({ id: itemRequests.id });

    if (updated.length === 0) {
      throw new Error("Could not update one or more lines. Refresh and try again.");
    }

    const afterWithdrawn = await getItemRequestById(id);
    if (afterWithdrawn && afterWithdrawn.status === "withdrawn") {
      await insertItemRequestLineSnapshot({
        itemRequestId: id,
        phase: "customer_line_edit",
        auditMemo:
          "Customer removed this request from the Products tab (withdrawn).",
        line: lineSnapshotPayloadFromItemRequest(afterWithdrawn),
      });
    }

    withdrawnIds.push(id);
  }

  return { withdrawnIds };
}
