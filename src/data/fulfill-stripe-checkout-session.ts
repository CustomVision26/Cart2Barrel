import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { applyPaidCheckoutFulfillmentForOrder } from "@/data/apply-paid-checkout-fulfillment";
import { recordCheckoutPaymentSucceededActivity } from "@/data/admin-user-activity-events";
import {
  fulfillOutboundShippingChargesFromCheckout,
  parseOutboundChargeIdsFromMetadata,
} from "@/data/fulfill-outbound-shipping-checkout";
import { markInCartBatchSessionsPaidForCheckoutOrder } from "@/data/mark-in-cart-batch-sessions-paid";
import { orderListSelect } from "@/data/order-list-select";
import { trySendOwnerPaidOrderReceiptEmail } from "@/data/owner-paid-order-receipt";
import { getDb } from "@/db";
import { orders, payments } from "@/db/schema";
import { fetchStripeFeeCentsForPaymentIntent } from "@/lib/stripe-balance-fee";
import { getStripeServer } from "@/lib/stripe-server";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

/** Call from route handlers, `after()`, etc. — not from React render / RSC body. */
export function revalidateAfterPaidCheckoutFulfillment(): void {
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/orders");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
}

/**
 * Marks an order paid, records payment, and advances line fulfillment — same rules as the
 * `checkout.session.completed` webhook. Idempotent: safe if the webhook already ran.
 *
 * @returns `true` when this invocation applied the paid transition (DB updated). `false` for
 *   no-ops (already fulfilled, mismatch, etc.). Callers use this to decide when to revalidate.
 */
export async function fulfillPaidCheckoutFromStripeSession(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const orderId = session.metadata?.orderId;
  const userId = session.client_reference_id;
  if (!orderId || !userId) {
    return false;
  }

  if (session.payment_status !== "paid") {
    return false;
  }

  const piRaw = session.payment_intent;
  const paymentIntentId =
    typeof piRaw === "string" ? piRaw : piRaw?.id ?? null;
  if (!paymentIntentId) {
    return false;
  }

  /** Stripe sometimes omits `amount_total` on embedded flows; derive from PI when possible. */
  let amountTotal = session.amount_total;
  if (amountTotal == null) {
    if (typeof piRaw === "object" && piRaw !== null) {
      const piObj = piRaw as {
        amount?: unknown;
        amount_received?: unknown;
      };
      const received = Number(piObj.amount_received);
      const auth = Number(piObj.amount);
      if (Number.isFinite(received) && received > 0) {
        amountTotal = received;
      } else if (Number.isFinite(auth) && auth > 0) {
        amountTotal = auth;
      }
    }
  }

  if (amountTotal == null) {
    return false;
  }
  const db = getDb();

  const dup = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (dup[0]) {
    return false;
  }

  const [order] = await db
    .select(orderListSelect)
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.clerkUserId !== userId) {
    return false;
  }

  if (order.status !== "pending") {
    return false;
  }

  if (order.totalAmount !== amountTotal) {
    return false;
  }

  const stripeTaxRaw = session.total_details?.amount_tax;
  const stripeTotalDetailsTaxCents =
    typeof stripeTaxRaw === "number" && Number.isFinite(stripeTaxRaw) ?
      stripeTaxRaw
    : null;

  let stripeFeeCents: number | null = null;
  try {
    stripeFeeCents = await fetchStripeFeeCentsForPaymentIntent(
      getStripeServer(),
      paymentIntentId,
    );
  } catch {
    stripeFeeCents = null;
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: paymentIntentId,
      stripeTotalDetailsTaxCents,
      stripeFeeCents,
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

  const outboundChargeIds = parseOutboundChargeIdsFromMetadata(
    session.metadata?.outboundChargeIds,
  );
  await fulfillOutboundShippingChargesFromCheckout(order.clerkUserId, outboundChargeIds, {
    orderId: order.id,
    stripePaymentIntentId: paymentIntentId,
  });

  await markInCartBatchSessionsPaidForCheckoutOrder(order.id);

  await recordCheckoutPaymentSucceededActivity({
    orderId: order.id,
    customerClerkUserId: order.clerkUserId,
    totalAmountCents: order.totalAmount,
  });

  await trySendOwnerPaidOrderReceiptEmail(order.id);

  return true;
}
