import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeServer(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3001";
}

/** Hosted Stripe Checkout (`checkout.stripe.com`) vs embedded on your site (`embedded_page`). */
export type StripeCheckoutUiMode = "hosted" | "embedded_page";

export function stripeCheckoutUiMode(): StripeCheckoutUiMode {
  const v = process.env.STRIPE_CHECKOUT_UI_MODE?.trim().toLowerCase();
  if (v === "hosted") return "hosted";
  return "embedded_page";
}

/** Cart checkout: secret key always; embedded mode also needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. */
export function isStripeCartCheckoutConfigured(): boolean {
  if (!isStripeSecretConfigured()) return false;
  if (stripeCheckoutUiMode() === "embedded_page") {
    return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
  }
  return true;
}

/**
 * Stripe SDK errors are plain objects with `message`, `type`, and `code`.
 * Use for actionable checkout failures (never log payment panics into UI verbatim beyond Stripe's own message).
 */
export function formatStripeApiErrorForUi(
  error: unknown,
  maxLen = 280
): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const o = error as Record<string, unknown>;
  const raw = typeof o.message === "string" ? o.message.trim() : "";
  if (!raw) return undefined;
  const type = typeof o.type === "string" ? o.type.trim() : "";
  const code = typeof o.code === "string" ? o.code.trim() : "";
  const meta = [type, code].filter(Boolean).join(", ");
  const text = meta ? `${raw} (${meta})` : raw;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

/**
 * Remaining charge amount on the Checkout PaymentIntent (USD cents), after Stripe refunds.
 */
export async function getPaymentIntentRefundableCents(
  paymentIntentId: string
): Promise<number | null> {
  try {
    const stripe = getStripeServer();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const lc = pi.latest_charge;
    if (typeof lc !== "object" || lc === null) {
      return null;
    }
    const ch = lc as Stripe.Charge;
    return ch.amount - (ch.amount_refunded ?? 0);
  } catch {
    return null;
  }
}
