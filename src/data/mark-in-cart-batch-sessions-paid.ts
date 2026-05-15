import { and, eq, inArray } from "drizzle-orm";

import { listItemRequestsForBatchSession } from "@/data/batch-quote-sessions";
import { appendBatchQuoteSessionStatusEvent } from "@/data/batch-quote-session-status-events";
import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessionLines,
  batchQuoteSessions,
  orderItems,
  orders,
} from "@/db/schema";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";

/**
 * After an order checks out successfully: batches that were `in_cart` with every linked
 * line represented in `order_items` move to `paid_pending_staff_purchase`.
 */
export async function markInCartBatchSessionsPaidForCheckoutOrder(
  orderId: string,
): Promise<void> {
  const db = getDb();
  const [order] = await db
    .select({
      clerkUserId: orders.clerkUserId,
      id: orders.id,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const rows = await db
    .select({ itemRequestId: orderItems.itemRequestId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const orderRequestIds = new Set(rows.map((r) => r.itemRequestId));
  if (orderRequestIds.size === 0) return;

  const links =
    await db
      .select({
        batchQuoteSessionId: batchQuoteSessionLines.batchQuoteSessionId,
        itemRequestId: batchQuoteSessionLines.itemRequestId,
      })
      .from(batchQuoteSessionLines)
      .where(inArray(batchQuoteSessionLines.itemRequestId, [...orderRequestIds]));

  const candidateSessionIds = [
    ...new Set(links.map((l) => l.batchQuoteSessionId)),
  ];
  if (candidateSessionIds.length === 0) return;

  const sessions = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        inArray(batchQuoteSessions.id, candidateSessionIds),
        eq(batchQuoteSessions.clerkUserId, order.clerkUserId),
        eq(batchQuoteSessions.status, "in_cart"),
      ),
    );

  for (const session of sessions) {
    const lineReqIdsRows = await db
      .select({ itemRequestId: batchQuoteSessionLines.itemRequestId })
      .from(batchQuoteSessionLines)
      .where(eq(batchQuoteSessionLines.batchQuoteSessionId, session.id));

    const lineIds = [...new Set(lineReqIdsRows.map((r) => r.itemRequestId))];
    if (lineIds.length === 0) continue;

    const allInOrder = lineIds.every((id) => orderRequestIds.has(id));
    if (!allInOrder) continue;

    const requests = await listItemRequestsForBatchSession(session.id);
    const acceptedEstimateId = session.cartAcceptanceAcceptedEstimateId;
    const [lockedEstimate] = acceptedEstimateId
      ? await db
          .select()
          .from(batchQuoteEstimates)
          .where(eq(batchQuoteEstimates.id, acceptedEstimateId))
          .limit(1)
      : [];

    const updated = await db
      .update(batchQuoteSessions)
      .set({
        status: "paid_pending_staff_purchase",
        cartAcceptanceAcceptedAt: null,
        cartAcceptanceAcceptedEstimateId: null,
      })
      .where(
        and(
          eq(batchQuoteSessions.id, session.id),
          eq(batchQuoteSessions.clerkUserId, order.clerkUserId),
          eq(batchQuoteSessions.status, "in_cart"),
        ),
      )
      .returning({ id: batchQuoteSessions.id });

    if (updated[0]) {
      const [sessionAfterPaid] = await db
        .select()
        .from(batchQuoteSessions)
        .where(eq(batchQuoteSessions.id, session.id))
        .limit(1);

      await appendBatchQuoteSessionStatusEvent({
        batchQuoteSessionId: session.id,
        clerkUserId: order.clerkUserId,
        kind: "paid_pending_staff_purchase",
        detail: {
          orderId: order.id,
          snapshot:
            sessionAfterPaid ?
              buildBatchQuoteHistorySnapshot({
                kind: "paid_pending_staff_purchase",
                session: sessionAfterPaid,
                requests,
                estimate: lockedEstimate ?? null,
                orderId: order.id,
              })
            : undefined,
        },
      });
    }
  }
}
