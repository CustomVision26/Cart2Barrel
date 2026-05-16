"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { listItemRequestsForBatchSession } from "@/data/batch-quote-sessions";
import { appendBatchQuoteSessionStatusEvent } from "@/data/batch-quote-session-status-events";
import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessions,
  itemRequests,
} from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";
import { removeBatchFromCartSchema } from "@/lib/validations/remove-batch-from-cart";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type RemoveBatchFromCartState = {
  ok: boolean;
  message?: string;
};

export async function removeBatchFromCartAction(
  raw: unknown
): Promise<RemoveBatchFromCartState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = removeBatchFromCartSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { batchSessionId, disposition } = parsed.data;
  const db = getDb();

  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, userId)
      )
    )
    .limit(1);

  if (!session) {
    return { ok: false, message: "Batch not found." };
  }

  const inCombinedBatchCart =
    session.status === "in_cart" ||
    Boolean(
      session.cartAcceptanceAcceptedAt &&
        session.cartAcceptanceAcceptedEstimateId
    );

  if (!inCombinedBatchCart) {
    return {
      ok: false,
      message: "This batch is not in your cart as a combined estimate.",
    };
  }

  const requests = await listItemRequestsForBatchSession(batchSessionId);
  const approved = requests.filter(
    (r) => r.clerkUserId === userId && r.status === "approved"
  );
  if (approved.length === 0) {
    return {
      ok: false,
      message: "No approved lines from this batch are in your cart.",
    };
  }

  const ids = approved.map((r) => r.id);

  try {
    // `neon-http` has no `.transaction()`; update lines first, then clear session cart fields.
    if (disposition === "withdraw_forever") {
      for (const request of approved) {
        await db
          .update(itemRequests)
          .set({ status: "withdrawn" })
          .where(
            and(
              eq(itemRequests.id, request.id),
              eq(itemRequests.clerkUserId, userId)
            )
          );
      }
    } else {
      await db
        .update(itemRequests)
        .set({ status: "quoted" })
        .where(
          and(
            inArray(itemRequests.id, ids),
            eq(itemRequests.clerkUserId, userId)
          )
        );
    }

    await db
      .update(batchQuoteSessions)
      .set({
        cartAcceptanceAcceptedAt: null,
        cartAcceptanceAcceptedEstimateId: null,
        status:
          session.status === "paid_pending_staff_purchase"
            ? "paid_pending_staff_purchase"
            : "estimated",
      })
      .where(
        and(
          eq(batchQuoteSessions.id, batchSessionId),
          eq(batchQuoteSessions.clerkUserId, userId)
        )
      );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update batch.";
    return { ok: false, message: msg };
  }

  if (
    disposition !== "withdraw_forever" &&
    (session.status === "in_cart" || session.cartAcceptanceAcceptedAt)
  ) {
    const [sessionAfterReturn] = await db
      .select()
      .from(batchQuoteSessions)
      .where(
        and(
          eq(batchQuoteSessions.id, batchSessionId),
          eq(batchQuoteSessions.clerkUserId, userId),
        ),
      )
      .limit(1);

    const returnedRequests = sessionAfterReturn
      ? await listItemRequestsForBatchSession(batchSessionId)
      : [];

    const [latestEstimate] = sessionAfterReturn
      ? await db
          .select()
          .from(batchQuoteEstimates)
          .where(
            and(
              eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
              isNull(batchQuoteEstimates.voidedAt),
            ),
          )
          .orderBy(desc(batchQuoteEstimates.createdAt))
          .limit(1)
      : [];

    await appendBatchQuoteSessionStatusEvent({
      batchQuoteSessionId: batchSessionId,
      clerkUserId: userId,
      kind: "returned_to_quoted_batch",
      detail:
        sessionAfterReturn ?
          {
            snapshot: buildBatchQuoteHistorySnapshot({
              kind: "returned_to_quoted_batch",
              session: sessionAfterReturn,
              requests: returnedRequests,
              estimate: latestEstimate ?? null,
            }),
          }
        : undefined,
    });
  }

  if (disposition === "withdraw_forever") {
    for (const request of approved) {
      await insertItemRequestLineSnapshot({
        itemRequestId: request.id,
        phase: "removed_from_cart",
        line: lineSnapshotPayloadFromItemRequest(request),
      });
    }
  }

  revalidatePath("/dashboard/cart");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");

  return {
    ok: true,
    message:
      disposition === "withdraw_forever"
        ? "Batch removed from your cart."
        : "Batch returned to quoted status. You can accept the estimate again from Batch history or Batch quotes.",
  };
}
