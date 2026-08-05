"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { batchQuoteSessionLines, itemRequests } from "@/db/schema";
import {
  getLatestQuoteForItemRequest,
  voidActiveQuotesForItemRequest,
} from "@/data/item-quotes";
import {
  getItemRequestById,
  resetQuotedRequestToPendingForRework,
} from "@/data/item-requests";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { loadQuoteExpirySettings } from "@/data/quote-expiry-settings";
import { ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION } from "@/lib/item-quote-void-reason";
import {
  effectiveQuoteExpiryMinutes,
  isQuoteExpired,
  resolveQuoteExpiryClockStart,
} from "@/lib/quote-expiry";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { z } from "zod";

const schema = z.object({
  itemRequestId: z.string().uuid(),
});

export type ResubmitExpiredQuoteState =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Customer resubmits an expired quoted product as a fresh pending request
 * (voids the old estimate; staff must quote again).
 */
export async function resubmitExpiredQuoteAction(
  raw: unknown,
): Promise<ResubmitExpiredQuoteState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const request = await getItemRequestById(parsed.data.itemRequestId);
  if (!request || request.clerkUserId !== userId) {
    return { ok: false, message: "Not found." };
  }

  if (request.status !== "quoted") {
    return {
      ok: false,
      message: "Only expired quoted products can be resubmitted from this list.",
    };
  }

  const quote = await getLatestQuoteForItemRequest(request.id);
  const { expiryMinutes } = await loadQuoteExpirySettings(userId);
  const lineMinutes = effectiveQuoteExpiryMinutes(
    expiryMinutes,
    request.quoteExpiryMinutesOverride,
  ).expiryMinutes;
  const clockStart = resolveQuoteExpiryClockStart({
    quoteIssuedAt: quote?.createdAt,
    productOverrideMinutes: request.quoteExpiryMinutesOverride,
    productOverrideAnchoredAt: request.quoteExpiryOverrideAnchoredAt,
  });
  if (!quote || !isQuoteExpired(clockStart, lineMinutes)) {
    return {
      ok: false,
      message:
        "This estimate is still within the payment window. Open Active to accept it, or use Preview estimate to request a revision.",
    };
  }

  const db = getDb();
  if (request.batchQuoteSessionId) {
    await db
      .delete(batchQuoteSessionLines)
      .where(
        and(
          eq(batchQuoteSessionLines.sessionId, request.batchQuoteSessionId),
          eq(batchQuoteSessionLines.itemRequestId, request.id),
        ),
      );
    await db
      .update(itemRequests)
      .set({ batchQuoteSessionId: null })
      .where(eq(itemRequests.id, request.id));
  }

  const reset = await resetQuotedRequestToPendingForRework(request.id, userId, {
    quantity: request.quantity,
    productSize: request.productSize,
    productColor: request.productColor,
  });

  if (!reset) {
    return {
      ok: false,
      message: "Could not resubmit this product. Refresh and try again.",
    };
  }

  try {
    await voidActiveQuotesForItemRequest(
      request.id,
      ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION,
    );
  } catch {
    return {
      ok: false,
      message:
        "Request was updated but archiving the previous estimate failed. Contact support.",
    };
  }

  const row = await getItemRequestById(request.id);
  if (row && row.clerkUserId === userId) {
    await insertItemRequestLineSnapshot({
      itemRequestId: row.id,
      phase: "customer_line_edit",
      line: lineSnapshotPayloadFromItemRequest(row),
    });
  }

  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items/requested-items");

  return {
    ok: true,
    message:
      "Resubmitted as a new pending request. Staff will send a fresh estimate.",
  };
}
