import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { barrelOutboundShippingCharges, orders } from "@/db/schema";
import {
  formatStripeApiErrorForUi,
  getPaymentIntentRefundableCents,
  getStripeServer,
} from "@/lib/stripe-server";

export type PerformOutboundShippingStripeRefundOutcome =
  | { ok: true; stripeRefundId: string | null; refundedCents: number }
  | { ok: false; message: string };

export async function performOutboundShippingStripeRefund(opts: {
  chargeId: string;
  amountCents: number;
}): Promise<PerformOutboundShippingStripeRefundOutcome> {
  const db = getDb();
  const [charge] = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      stripePaymentIntentId: barrelOutboundShippingCharges.stripePaymentIntentId,
      paidOrderId: barrelOutboundShippingCharges.paidOrderId,
    })
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.id, opts.chargeId))
    .limit(1);

  if (!charge) {
    return { ok: false, message: "Shipping charge not found." };
  }

  let paymentIntentId = charge.stripePaymentIntentId?.trim() || null;
  if (!paymentIntentId && charge.paidOrderId) {
    const [order] = await db
      .select({ stripePaymentIntentId: orders.stripePaymentIntentId })
      .from(orders)
      .where(eq(orders.id, charge.paidOrderId))
      .limit(1);
    paymentIntentId = order?.stripePaymentIntentId?.trim() || null;
  }

  if (!paymentIntentId) {
    return {
      ok: false,
      message:
        "This freight charge has no Stripe payment on file, so it cannot be refunded automatically.",
    };
  }

  const remaining = await getPaymentIntentRefundableCents(paymentIntentId);
  if (remaining == null) {
    return {
      ok: false,
      message: "Stripe could not confirm the remaining refundable amount.",
    };
  }
  if (remaining <= 0) {
    return { ok: true, stripeRefundId: null, refundedCents: 0 };
  }

  const refundCents = Math.min(Math.max(0, opts.amountCents), remaining);
  if (refundCents <= 0) {
    return { ok: true, stripeRefundId: null, refundedCents: 0 };
  }

  try {
    const stripe = getStripeServer();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: {
        charge_id: opts.chargeId,
        charge_target: "outbound_shipping",
      },
    });
    return {
      ok: true,
      stripeRefundId: refund.id,
      refundedCents: refundCents,
    };
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
}
