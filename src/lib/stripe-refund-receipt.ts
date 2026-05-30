import type Stripe from "stripe";

import { isStripeRefundId } from "@/lib/stripe-refund-id";
import { getStripeServer } from "@/lib/stripe-server";

function receiptUrlFromCharge(charge: unknown): string | null {
  if (typeof charge !== "object" || charge === null) return null;
  const url = (charge as { receipt_url?: unknown }).receipt_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function chargeIdFromRefundCharge(charge: Stripe.Refund["charge"]): string | null {
  if (typeof charge === "string") {
    const t = charge.trim();
    return t || null;
  }
  if (Array.isArray(charge) && charge.length > 0) {
    const first = charge[0];
    if (typeof first === "string") {
      const t = first.trim();
      return t || null;
    }
  }
  return null;
}

async function receiptUrlFromChargeId(
  stripe: Stripe,
  chargeId: string,
): Promise<string | null> {
  if (chargeId.startsWith("ch_")) {
    const charge = await stripe.charges.retrieve(chargeId);
    return charge.receipt_url?.trim() || null;
  }
  return null;
}

export function isStripePaymentIntentId(
  value: string | null | undefined,
): boolean {
  const id = value?.trim() ?? "";
  return id.startsWith("pi_");
}

export async function getStripePaymentReceiptUrl(
  paymentIntentId: string,
): Promise<string | null> {
  if (!isStripePaymentIntentId(paymentIntentId)) {
    return null;
  }

  try {
    const stripe = getStripeServer();
    return receiptUrlFromPaymentIntentId(stripe, paymentIntentId.trim());
  } catch {
    return null;
  }
}

async function receiptUrlFromPaymentIntentId(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<string | null> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const latest = intent.latest_charge;
  const fromExpanded = receiptUrlFromCharge(latest);
  if (fromExpanded) return fromExpanded;
  if (typeof latest === "string") {
    return receiptUrlFromChargeId(stripe, latest);
  }
  return null;
}

/** Stripe-hosted receipt URL for a refund (via expanded charge), when available. */
export async function getStripeRefundReceiptUrl(
  stripeRefundId: string,
): Promise<string | null> {
  if (!isStripeRefundId(stripeRefundId)) {
    return null;
  }

  try {
    const stripe = getStripeServer();
    const refund = await stripe.refunds.retrieve(stripeRefundId, {
      expand: ["charge", "payment_intent.latest_charge"],
    });

    const expandedChargeUrl = receiptUrlFromCharge(refund.charge);
    if (expandedChargeUrl) return expandedChargeUrl;

    const chargeId = chargeIdFromRefundCharge(refund.charge);
    if (chargeId) {
      const fromCharge = await receiptUrlFromChargeId(stripe, chargeId);
      if (fromCharge) return fromCharge;
    }

    const pi = refund.payment_intent;
    if (typeof pi === "object" && pi !== null) {
      const fromPi = receiptUrlFromCharge(pi.latest_charge);
      if (fromPi) return fromPi;
      if (typeof pi.latest_charge === "string") {
        const fromLc = await receiptUrlFromChargeId(stripe, pi.latest_charge);
        if (fromLc) return fromLc;
      }
    }
    if (typeof pi === "string" && pi.trim()) {
      return receiptUrlFromPaymentIntentId(stripe, pi.trim());
    }

    return null;
  } catch {
    return null;
  }
}
