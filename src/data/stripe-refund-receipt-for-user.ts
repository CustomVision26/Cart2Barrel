import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemRefunds, orderItems, orders } from "@/db/schema";
import { getStripeRefundReceiptUrl } from "@/lib/stripe-refund-receipt";

export type StripeRefundReceiptForUserResult =
  | { ok: true; receiptUrl: string }
  | { ok: false; message: string };

/** Resolves a Stripe refund receipt URL when the refund belongs to the signed-in customer. */
export async function getStripeRefundReceiptUrlForCustomer(opts: {
  clerkUserId: string;
  stripeRefundId: string;
}): Promise<StripeRefundReceiptForUserResult> {
  const refundId = opts.stripeRefundId.trim();
  if (!refundId.startsWith("re_")) {
    return { ok: false, message: "Invalid refund reference." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      orderClerkUserId: orders.clerkUserId,
    })
    .from(orderItemRefunds)
    .innerJoin(orderItems, eq(orderItemRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItemRefunds.stripeRefundId, refundId))
    .limit(1);

  if (!row) {
    return { ok: false, message: "Refund not found." };
  }
  if (row.orderClerkUserId !== opts.clerkUserId) {
    return { ok: false, message: "You do not have access to this refund receipt." };
  }

  const receiptUrl = await getStripeRefundReceiptUrl(refundId);
  if (!receiptUrl) {
    return {
      ok: false,
      message:
        "Stripe has not published a receipt for this refund yet. Check your email from Stripe or try again later.",
    };
  }

  return { ok: true, receiptUrl };
}
