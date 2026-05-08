/**
 * Default exclusions for a simpler Checkout (card + common wallets), closer to a minimal
 * hosted page. Tune via STRIPE_CHECKOUT_EXCLUDED_PAYMENT_METHOD_TYPES in `.env`.
 *
 * Set to `none` to restore Dashboard defaults (more payment methods).
 *
 * @see https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-excluded_payment_method_types
 */
const DEFAULT_CHECKOUT_EXCLUDED_PAYMENT_METHODS = [
  "affirm",
  "amazon_pay",
  "klarna",
  "us_bank_account",
] as const;

export function checkoutExcludedPaymentMethodTypes(): string[] | undefined {
  const raw = process.env.STRIPE_CHECKOUT_EXCLUDED_PAYMENT_METHOD_TYPES?.trim();
  if (raw && /^none$/i.test(raw)) {
    return undefined;
  }
  if (!raw) {
    return [...DEFAULT_CHECKOUT_EXCLUDED_PAYMENT_METHODS];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}
