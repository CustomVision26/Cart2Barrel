import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { applyPaidCheckoutFulfillmentForOrder } from "@/data/apply-paid-checkout-fulfillment";
import { orderListSelect } from "@/data/order-list-select";
import { trySendOwnerPaidOrderReceiptEmail } from "@/data/owner-paid-order-receipt";
import { getDb } from "@/db";
import { orders, payments } from "@/db/schema";

/**
 * Marks an order paid, records payment, and advances line fulfillment — same rules as the
 * `checkout.session.completed` webhook. Idempotent: safe if the webhook already ran.
 */
export async function fulfillPaidCheckoutFromStripeSession(
  session: Stripe.Checkout.Session
): Promise<void> {
  const orderId = session.metadata?.orderId;
  const userId = session.client_reference_id;
  if (!orderId || !userId) {
    return;
  }

  if (session.payment_status !== "paid") {
    return;
  }

  const piRaw = session.payment_intent;
  const paymentIntentId =
    typeof piRaw === "string" ? piRaw : piRaw?.id ?? null;
  if (!paymentIntentId) {
    return;
  }

  const amountTotal = session.amount_total;
  if (amountTotal == null) {
    return;
  }

  const db = getDb();

  const dup = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (dup[0]) {
    return;
  }

  const [order] = await db
    .select(orderListSelect)
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.clerkUserId !== userId) {
    return;
  }

  if (order.status !== "pending") {
    return;
  }

  if (order.totalAmount !== amountTotal) {
    return;
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: paymentIntentId,
    })
    .where(eq(orders.id, order.id));

  await db.insert(payments).values({
    clerkUserId: order.clerkUserId,
    orderId: order.id,
    amount: order.totalAmount,
    status: "succeeded",
    stripePaymentIntentId: paymentIntentId,
  });

  await applyPaidCheckoutFulfillmentForOrder(order.id);

  await trySendOwnerPaidOrderReceiptEmail(order.id);

  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/items/new");
  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/item-requests");
}
