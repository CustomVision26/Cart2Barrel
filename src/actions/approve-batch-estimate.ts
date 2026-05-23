"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { listItemRequestsForBatchSession } from "@/data/batch-quote-sessions";
import { appendBatchQuoteSessionStatusEvent } from "@/data/batch-quote-session-status-events";
import { recordBatchEstimateAcceptedActivity } from "@/data/admin-user-activity-events";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";
import {
  getLatestQuoteForItemRequest,
  restoreOrphanQuotedItemRequestQuote,
} from "@/data/item-quotes";
import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessions,
  itemRequests,
} from "@/db/schema";
import {
  combinedErrorText,
  getPgErrorCode,
  isMissingBatchCartAcceptanceColumnsError,
} from "@/lib/db-column-missing";
import { approveBatchEstimateSchema } from "@/lib/validations/approve-batch-estimate";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type ApproveBatchEstimateState = {
  ok: boolean;
  message?: string;
};

function quoteFailureLabel(productName: string | null): string {
  const t = productName?.trim();
  return t ? `"${t.slice(0, 80)}${t.length > 80 ? "…" : ""}"` : "one product";
}

export async function approveBatchEstimateAction(
  raw: unknown
): Promise<ApproveBatchEstimateState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = approveBatchEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const batchSessionId = parsed.data.batchSessionId;
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

  if (
    session.cartAcceptanceAcceptedAt ||
    session.status === "in_cart"
  ) {
    return {
      ok: true,
      message: "This batch is already in your cart with the combined estimate total.",
    };
  }

  if (session.status !== "estimated") {
    return {
      ok: false,
      message:
        session.status === "draft"
          ? "Submit this batch before staff can quote it."
          : session.status === "submitted"
            ? "Staff has not saved a batch estimate yet."
            : session.status === "paid_pending_staff_purchase"
              ? "This batch was already checked out."
              : "This batch estimate cannot be accepted now.",
    };
  }

  const requests = await listItemRequestsForBatchSession(batchSessionId);
  if (requests.length === 0) {
    return { ok: false, message: "This batch has no line items." };
  }

  const [estimate] = await db
    .select()
    .from(batchQuoteEstimates)
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
        isNull(batchQuoteEstimates.voidedAt)
      )
    )
    .orderBy(desc(batchQuoteEstimates.createdAt))
    .limit(1);

  if (!estimate) {
    return {
      ok: false,
      message: "No active batch estimate was found. Ask staff to save the estimate again.",
    };
  }

  let alreadyApproved = 0;

  /** Lines already in cart (`approved`). */
  const preApprovedRequests: typeof requests = [];
  /** Everything else batch session lists must have an operational quote to accept into cart. */
  const needsQuoteVerification: typeof requests = [];

  for (const request of requests) {
    if (request.clerkUserId !== userId) {
      return { ok: false, message: "One or more items could not be verified." };
    }
    if (request.status === "approved") {
      preApprovedRequests.push(request);
      alreadyApproved++;
      continue;
    }
    if (request.status === "withdrawn") {
      return {
        ok: false,
        message: `${quoteFailureLabel(request.productName)} was withdrawn. The bundled total still includes every original line, so it cannot be accepted as-is. Open Preview estimate, then tap Request estimate — that removes withdrawn products from the bundle and sends the rest back to staff for an updated total.`,
      };
    }
    if (request.status === "rejected") {
      return {
        ok: false,
        message:
          "This batch includes a rejected product. Refresh or ask staff about that line.",
      };
    }

    needsQuoteVerification.push(request);
  }

  const linesToApproveIntoCart: (typeof requests)[number][] = [];
  for (const request of needsQuoteVerification) {
    let quote = await getLatestQuoteForItemRequest(request.id);
    if (!quote) {
      quote = await restoreOrphanQuotedItemRequestQuote(request.id);
    }
    if (!quote) {
      if (request.status === "pending") {
        return {
          ok: false,
          message: `${quoteFailureLabel(request.productName)} is waiting for staff to save an estimate (status is Pending). Refresh after staff publishes a quote.`,
        };
      }
      return {
        ok: false,
        message: `${quoteFailureLabel(request.productName)} is missing its staff estimate rows. Refresh the page, or ask staff to re-save that line.`,
      };
    }
    linesToApproveIntoCart.push(request);
  }

  let approvedNow = 0;

  try {
    // `neon-http` has no `.transaction()`; approve lines first so a retry can finish
    // the session row if the last write fails.
    for (const request of linesToApproveIntoCart) {
      await db
        .update(itemRequests)
        .set({ status: "approved" })
        .where(
          and(
            eq(itemRequests.id, request.id),
            eq(itemRequests.clerkUserId, userId)
          )
        );
      approvedNow++;
    }

    await db
      .update(batchQuoteSessions)
      .set({
        cartAcceptanceAcceptedAt: new Date().toISOString(),
        cartAcceptanceAcceptedEstimateId: estimate.id,
        status: "in_cart",
      })
      .where(
        and(
          eq(batchQuoteSessions.id, batchSessionId),
          eq(batchQuoteSessions.clerkUserId, userId)
        )
      );

    const [sessionAfterAccept] = await db
      .select()
      .from(batchQuoteSessions)
      .where(
        and(
          eq(batchQuoteSessions.id, batchSessionId),
          eq(batchQuoteSessions.clerkUserId, userId),
        ),
      )
      .limit(1);

    await appendBatchQuoteSessionStatusEvent({
      batchQuoteSessionId: batchSessionId,
      clerkUserId: userId,
      kind: "in_cart",
      detail:
        sessionAfterAccept ?
          {
            snapshot: buildBatchQuoteHistorySnapshot({
              kind: "in_cart",
              session: sessionAfterAccept,
              requests,
              estimate,
            }),
          }
        : undefined,
    });

    if (approvedNow > 0 && sessionAfterAccept) {
      await recordBatchEstimateAcceptedActivity({
        customerClerkUserId: userId,
        batchSessionId,
        batchNumber: sessionAfterAccept.batchNumber,
      });
    }
  } catch (e) {
    if (isMissingBatchCartAcceptanceColumnsError(e)) {
      return {
        ok: false,
        message:
          "Your database is missing batch cart columns. Run `npm run db:push` locally (or apply migration `0016_batch_cart_acceptance.sql`), then try again.",
      };
    }
    const pgCode = getPgErrorCode(e);
    if (pgCode === "23503") {
      return {
        ok: false,
        message:
          "This batch or estimate no longer matches the database. Refresh the page and try again; if it persists, ask staff to re-save the batch estimate.",
      };
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[approveBatchEstimateAction]", combinedErrorText(e));
    }
    return {
      ok: false,
      message:
        "Could not add this batch to your cart. If you are the developer, check the server log for details and confirm migrations are applied.",
    };
  }

  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");

  if (approvedNow === 0 && alreadyApproved === requests.length) {
    return {
      ok: true,
      message:
        "Batch is in your cart with the combined staff estimate total. Open Cart to review or check out.",
    };
  }

  if (alreadyApproved > 0 && approvedNow > 0) {
    return {
      ok: true,
      message: `Added ${approvedNow} product(s) to your cart (${alreadyApproved} were already accepted). The batch total uses the staff bundle estimate.`,
    };
  }

  return {
    ok: true,
    message:
      approvedNow === 1
        ? "Added to cart. The batch total uses the staff bundle estimate."
        : `Added ${approvedNow} products to cart. The batch total uses the staff bundle estimate.`,
  };
}
