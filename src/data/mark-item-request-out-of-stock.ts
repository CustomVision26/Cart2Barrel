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
import { ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK } from "@/lib/item-quote-void-reason";
import { recordItemOutOfStockActivity } from "@/data/user-status-update-events";

/**
 * Staff marks a pending or quoted line as out of stock: voids operational quotes,
 * detaches draft batches, updates status, and records an audit snapshot.
 */
export async function markItemRequestOutOfStockForAdmin(params: {
  itemRequestId: string;
  staffNote?: string | null;
  attachmentImageUrls?: string[] | null;
}): Promise<void> {
  const itemRequestId = params.itemRequestId;
  const staffNote = params.staffNote?.trim() || null;
  const attachmentImageUrls =
    params.attachmentImageUrls?.filter((url) => url.trim().length > 0) ?? [];
  const row = await getItemRequestById(itemRequestId);
  if (!row) {
    throw new Error("Product request not found.");
  }

  if (row.status !== "pending" && row.status !== "quoted") {
    throw new Error("Only pending or quoted requests can be marked out of stock.");
  }

  const db = getDb();
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
        .where(eq(itemRequests.id, itemRequestId));
    } else if (sess.status === "draft") {
      await removeItemRequestsFromOwnerDraftBatchSession({
        clerkUserId: row.clerkUserId,
        batchSessionId: sid,
        itemRequestIds: [itemRequestId],
      });
    } else {
      throw new Error(
        "This product is part of a submitted or quoted batch. Resolve the batch first."
      );
    }
  }

  const ready = await getItemRequestById(itemRequestId);
  if (!ready) {
    throw new Error("Product request not found.");
  }

  if (ready.status === "quoted") {
    await voidActiveQuotesForItemRequest(
      itemRequestId,
      ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK
    );
  }

  const statusBefore = ready.status;
  const updated = await db
    .update(itemRequests)
    .set({
      status: "out_of_stock",
      outOfStockStaffNote: staffNote,
      outOfStockAttachmentImageUrls:
        attachmentImageUrls.length > 0 ? attachmentImageUrls : null,
    })
    .where(
      and(
        eq(itemRequests.id, itemRequestId),
        eq(itemRequests.status, statusBefore)
      )
    )
    .returning({ id: itemRequests.id });

  if (updated.length === 0) {
    throw new Error("Could not update this request. Refresh and try again.");
  }

  const after = await getItemRequestById(itemRequestId);
  if (after && after.status === "out_of_stock") {
    const auditMemoParts = ["Staff marked this product as out of stock."];
    if (staffNote) {
      auditMemoParts.push(`Staff note: ${staffNote}`);
    }
    if (attachmentImageUrls.length > 0) {
      auditMemoParts.push(
        `Attachment images: ${attachmentImageUrls.length} uploaded.`,
      );
    }

    await insertItemRequestLineSnapshot({
      itemRequestId,
      phase: "post_admin_estimate_edit",
      auditMemo: auditMemoParts.join(" "),
      line: lineSnapshotPayloadFromItemRequest(after),
    });

    await recordItemOutOfStockActivity({
      clerkUserId: after.clerkUserId,
      itemRequestId: after.id,
      productName: after.productName,
      staffNote,
    });
  }
}
