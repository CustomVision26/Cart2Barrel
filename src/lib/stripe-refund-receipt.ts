import { getStripeServer } from "@/lib/stripe-server";

/** Stripe-hosted receipt URL for a refund (via expanded charge), when available. */
export async function getStripeRefundReceiptUrl(
  stripeRefundId: string,
): Promise<string | null> {
  try {
    const stripe = getStripeServer();
    const refund = await stripe.refunds.retrieve(stripeRefundId, {
      expand: ["charge"],
    });
    const charge = refund.charge;
    if (typeof charge === "object" && charge !== null) {
      const receiptUrl =
        "receipt_url" in charge &&
        typeof charge.receipt_url === "string" &&
        charge.receipt_url.trim() ?
          charge.receipt_url.trim()
        : null;
      if (receiptUrl) return receiptUrl;
    }
    return null;
  } catch {
    return null;
  }
}
