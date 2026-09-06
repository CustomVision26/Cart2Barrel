import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { ensureMerchandiseReconciliationSchema } from "@/data/ensure-merchandise-reconciliation-schema";
import {
  appendSupportTicketMessage,
  insertSupportTicketWithMessage,
  resolveMerchandisePriceDialogueTicket,
} from "@/data/support-tickets";
import { getDb } from "@/db";
import {
  batchQuoteSessionLines,
  batchQuoteSessions,
  itemRequests,
  orderItemMerchandiseReconciliations,
  orderItems,
} from "@/db/schema";
import { isMissingMerchandiseReconciliationTableError } from "@/lib/db-column-missing";
import {
  defaultMerchandiseTopupPaidMessage,
  formatMerchandiseTopupNumber,
} from "@/lib/merchandise-reconciliation";

/**
 * Post a staff thank-you on the price-update dialogue after a top-up is paid
 * (Stripe checkout or admin “Mark top-up paid”).
 */
export async function notifyCustomerMerchandiseTopupPaid(params: {
  clerkUserId: string;
  reconciliationIds: string[];
  /** Staff sender; defaults to the admin who created the reconciliation. */
  staffClerkUserId?: string | null;
}): Promise<void> {
  if (params.reconciliationIds.length === 0) return;
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();

  try {
    const rows = await db
      .select({
        id: orderItemMerchandiseReconciliations.id,
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        topupAmountCents: orderItemMerchandiseReconciliations.topupAmountCents,
        topupPaidTotalCents:
          orderItemMerchandiseReconciliations.topupPaidTotalCents,
        topupRefundedCents:
          orderItemMerchandiseReconciliations.topupRefundedCents,
        topupCheckoutOrderId:
          orderItemMerchandiseReconciliations.topupCheckoutOrderId,
        createdByClerkUserId:
          orderItemMerchandiseReconciliations.createdByClerkUserId,
        orderItemId: orderItems.id,
        itemRequestId: itemRequests.id,
        merchandiseOrderId: orderItems.orderId,
        linePriceCents: orderItems.price,
        productName: itemRequests.productName,
        batchQuoteSessionId: itemRequests.batchQuoteSessionId,
      })
      .from(orderItemMerchandiseReconciliations)
      .innerJoin(
        orderItems,
        eq(orderItemMerchandiseReconciliations.orderItemId, orderItems.id),
      )
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
          inArray(
            orderItemMerchandiseReconciliations.id,
            params.reconciliationIds,
          ),
        ),
      );

    if (rows.length === 0) return;

    const primary = rows[0]!;
    const topupAmountCents = Math.max(0, primary.topupAmountCents ?? 0);
    if (topupAmountCents <= 0) return;

    const productNames = rows.map(
      (r) => r.productName?.trim() || "Order product",
    );
    const checkoutSubtotalCents = rows.reduce(
      (sum, r) => sum + Math.max(0, r.linePriceCents),
      0,
    );
    const paidTotalNet = Math.max(
      0,
      Math.max(0, primary.topupPaidTotalCents ?? 0) -
        Math.max(0, primary.topupRefundedCents ?? 0),
    );
    // After mark-paid, paid total includes this payment; prior = total − this.
    const priorPaidTopupCents = Math.max(0, paidTotalNet - topupAmountCents);
    const newTotalCents = checkoutSubtotalCents + paidTotalNet;

    const sessionIds = new Set(
      rows
        .map((r) => r.batchQuoteSessionId)
        .filter((id): id is string => Boolean(id)),
    );

    const itemRequestIds = rows.map((r) => r.itemRequestId);
    if (sessionIds.size === 0 && itemRequestIds.length > 0) {
      const links = await db
        .select({
          batchQuoteSessionId: batchQuoteSessionLines.batchQuoteSessionId,
        })
        .from(batchQuoteSessionLines)
        .where(inArray(batchQuoteSessionLines.itemRequestId, itemRequestIds));
      for (const link of links) {
        sessionIds.add(link.batchQuoteSessionId);
      }
    }

    let batchNumber: string | null = null;
    if (sessionIds.size === 1) {
      const sessionId = Array.from(sessionIds)[0]!;
      const [batch] = await db
        .select({ batchNumber: batchQuoteSessions.batchNumber })
        .from(batchQuoteSessions)
        .where(
          and(
            eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
            eq(batchQuoteSessions.id, sessionId),
          ),
        )
        .limit(1);
      batchNumber = batch?.batchNumber?.trim() || null;
    }

    const body = defaultMerchandiseTopupPaidMessage({
      topupNumber: formatMerchandiseTopupNumber(primary.id),
      topupAmountCents,
      priorPaidTopupCents,
      topupCheckoutOrderId: primary.topupCheckoutOrderId,
      merchandiseOrderId: primary.merchandiseOrderId,
      batchNumber,
      productNames,
      checkoutSubtotalCents,
      newTotalCents,
    });

    const staffClerkUserId =
      params.staffClerkUserId?.trim() ||
      primary.createdByClerkUserId.trim() ||
      params.clerkUserId;

    const orderItemIds = rows.map((r) => r.orderItemId);
    const dialogue = await resolveMerchandisePriceDialogueTicket({
      clerkUserId: params.clerkUserId,
      preferredTicketId: primary.supportTicketId,
      orderItemIds,
    });
    let ticketId = dialogue?.id ?? null;

    if (ticketId) {
      await appendSupportTicketMessage({
        ticketId,
        senderClerkUserId: staffClerkUserId,
        isFromStaff: true,
        body,
        nextStatus: "awaiting_customer",
      });
    } else {
      const created = await insertSupportTicketWithMessage({
        clerkUserId: params.clerkUserId,
        subject: "Purchase price update — top-up received",
        body,
        isFromStaff: true,
        senderClerkUserId: staffClerkUserId,
        status: "awaiting_customer",
      });
      ticketId = created.ticketId;
      await db
        .update(orderItemMerchandiseReconciliations)
        .set({ supportTicketId: ticketId })
        .where(
          and(
            eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
            inArray(
              orderItemMerchandiseReconciliations.id,
              params.reconciliationIds,
            ),
          ),
        );
    }
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return;
    console.error(
      "[Amani Cart2Barrel] notifyCustomerMerchandiseTopupPaid failed:",
      e,
    );
  }
}
