import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orders } from "@/db/schema";
import {
  getStripePaymentReceiptUrl,
  isStripePaymentIntentId,
} from "@/lib/stripe-refund-receipt";

export type StripePaymentReceiptForUserResult =
  | { ok: true; receiptUrl: string }
  | { ok: false; message: string };

/** Resolves a Stripe payment receipt URL when the order belongs to the signed-in customer. */
export async function getStripePaymentReceiptUrlForCustomer(opts: {
  clerkUserId: string;
  orderId: string;
}): Promise<StripePaymentReceiptForUserResult> {
  const orderId = opts.orderId.trim();
  if (!orderId) {
    return { ok: false, message: "Missing order reference." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      clerkUserId: orders.clerkUserId,
      status: orders.status,
      stripePaymentIntentId: orders.stripePaymentIntentId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) {
    return { ok: false, message: "Order not found." };
  }
  if (row.clerkUserId !== opts.clerkUserId) {
    return { ok: false, message: "You do not have access to this receipt." };
  }
  if (row.status !== "paid") {
    return { ok: false, message: "This order has not been paid yet." };
  }

  const paymentIntentId = row.stripePaymentIntentId?.trim() ?? "";
  if (!isStripePaymentIntentId(paymentIntentId)) {
    return { ok: false, message: "No Stripe payment is linked to this order." };
  }

  const receiptUrl = await getStripePaymentReceiptUrl(paymentIntentId);
  if (!receiptUrl) {
    return {
      ok: false,
      message:
        "Stripe has not published a receipt for this payment yet. Check your email from Stripe or try again later.",
    };
  }

  return { ok: true, receiptUrl };
}
