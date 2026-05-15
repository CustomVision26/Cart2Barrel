import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, orderItems, orders, profiles } from "@/db/schema";
import { orderListSelect } from "@/data/order-list-select";
import {
  insertOrderItemRefundRow,
  sumRefundedCentsByOrderItemIds,
} from "@/data/order-item-refunds";
import { sendOrderLineRefundEmail } from "@/lib/email/send-order-line-refund-email";
import {
  formatStripeApiErrorForUi,
  getAppOrigin,
  getPaymentIntentRefundableCents,
  getStripeServer,
} from "@/lib/stripe-server";

export type PerformOrderItemStripeRefundOutcome =
  | {
      ok: true;
      stripeRefundId: string;
      refundedCents: number;
      newTotalRefundedCents: number;
      lineFullyRefunded: boolean;
      orderId: string;
      customerEmail: string | null;
      customerFullName: string | null;
      productName: string | null;
    }
  | { ok: false; message: string };

/** Issues Stripe refund, persists `order_item_refunds`, sets line `refunded` when fully reimbursed. Sends optional customer email when profile email exists. */
export async function performOrderItemStripeRefund(opts: {
  orderItemId: string;
  amountCentsRequested: number;
  internalReasonForDb: string | null;
  stripeReason: "duplicate" | "fraudulent" | "requested_by_customer";
  createdByClerkUserId: string;
}): Promise<PerformOrderItemStripeRefundOutcome> {
  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItems,
      order: orderListSelect,
      request: itemRequests,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .where(eq(orderItems.id, opts.orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid" || !row.order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "Order line not found or payment is not available to refund.",
    };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds([
    row.orderItem.id,
  ]);
  const alreadyRefunded = refundedMap.get(row.orderItem.id) ?? 0;
  const lineRemaining = row.orderItem.price - alreadyRefunded;
  if (lineRemaining <= 0) {
    return { ok: false, message: "This line has already been fully refunded." };
  }

  const piRemaining = await getPaymentIntentRefundableCents(
    row.order.stripePaymentIntentId,
  );
  if (piRemaining === null || piRemaining <= 0) {
    return {
      ok: false,
      message:
        "Could not read the Stripe charge for this payment, or nothing is left to refund.",
    };
  }

  const cap = Math.min(lineRemaining, piRemaining);
  const refundCents = Math.min(opts.amountCentsRequested, cap);

  if (refundCents < 1) {
    return {
      ok: false,
      message: "Refund amount is too small or nothing is refundable.",
    };
  }

  const stripe = getStripeServer();
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: row.order.stripePaymentIntentId,
      amount: refundCents,
      reason: opts.stripeReason,
      metadata: {
        order_id: row.order.id,
        order_item_id: row.orderItem.id,
      },
    });
    stripeRefundId = refund.id;
  } catch (e) {
    const detail = formatStripeApiErrorForUi(e);
    return {
      ok: false,
      message:
        detail ?
          `Stripe could not process the refund: ${detail}`
        : "Stripe could not process the refund.",
    };
  }

  await insertOrderItemRefundRow({
    orderItemId: row.orderItem.id,
    amountCents: refundCents,
    stripeRefundId,
    reason: opts.internalReasonForDb?.trim() || null,
    createdByClerkUserId: opts.createdByClerkUserId,
  });

  const newTotalRefunded = alreadyRefunded + refundCents;
  let lineFullyRefunded = false;
  if (newTotalRefunded >= row.orderItem.price) {
    lineFullyRefunded = true;
    await db
      .update(orderItems)
      .set({ fulfillmentStatus: "refunded" })
      .where(eq(orderItems.id, row.orderItem.id));
  }

  const shopperEmail = row.customerEmail?.trim();
  if (shopperEmail) {
    const origin = getAppOrigin();
    const emailed = await sendOrderLineRefundEmail({
      origin,
      customerEmail: shopperEmail,
      customerName: row.customerFullName,
      orderId: row.order.id,
      productName: row.request.productName,
      refundCents,
      stripeRefundId,
    });
    if (!emailed.ok) {
      console.warn(
        "[Cart2Barrel] Refund processed but customer email failed:",
        emailed.error,
      );
    }
  }

  return {
    ok: true,
    stripeRefundId,
    refundedCents: refundCents,
    newTotalRefundedCents: newTotalRefunded,
    lineFullyRefunded,
    orderId: row.order.id,
    customerEmail: row.customerEmail ?? null,
    customerFullName: row.customerFullName ?? null,
    productName: row.request.productName ?? null,
  };
}
