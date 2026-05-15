import type Stripe from "stripe";

/**
 * Loads the Stripe processing fee (BalanceTransaction.fee) for a succeeded PaymentIntent.
 * Returns null if the charge or balance transaction is missing.
 */
export async function fetchStripeFeeCentsForPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<number | null> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = pi.latest_charge;
  if (typeof charge === "string" || charge == null) {
    return null;
  }
  const btRaw = charge.balance_transaction;
  if (typeof btRaw === "string" || btRaw == null) {
    return null;
  }
  const fee = (btRaw as Stripe.BalanceTransaction).fee;
  return typeof fee === "number" && Number.isFinite(fee) ? fee : null;
}
