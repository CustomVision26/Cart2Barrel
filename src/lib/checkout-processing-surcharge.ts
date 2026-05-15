/** Region drives which basis-points + fixed surcharge apply at checkout (from primary shipping country). */
export type CheckoutProcessingFeeRegion = "domestic_us" | "international";

const MIN_CHECKOUT_LINE_CENTS = 50;

export function isCheckoutProcessingSurchargeEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_SURCHARGE_ENABLED !== "false";
}

function parseEnvInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Primary shipping `country` from `addresses.country` (or null if none).
 * Anything outside normalized US is treated as international (incl. default Jamaica).
 */
export function processingFeeRegionFromShippingCountry(
  country: string | null | undefined,
): CheckoutProcessingFeeRegion {
  if (!country?.trim()) return "international";
  const n = country.trim().toLowerCase();
  if (
    n === "us" ||
    n === "usa" ||
    n === "u.s." ||
    n === "u.s.a." ||
    n === "united states" ||
    n === "united states of america"
  ) {
    return "domestic_us";
  }
  return "international";
}

export function checkoutProcessingFeeRegionLabel(
  region: CheckoutProcessingFeeRegion,
): string {
  return region === "domestic_us" ? "US cards" : "International cards";
}

/**
 * Approximate pass-through of Stripe-style pricing: bps on merchandise subtotal + fixed cents.
 * When the computed fee is non-zero but below Stripe’s per-line minimum, it is rounded up.
 */
export function computeCheckoutProcessingSurchargeCents(
  merchandiseSubtotalCents: number,
  region: CheckoutProcessingFeeRegion,
): number {
  if (
    !isCheckoutProcessingSurchargeEnabled() ||
    merchandiseSubtotalCents <= 0 ||
    !Number.isFinite(merchandiseSubtotalCents)
  ) {
    return 0;
  }

  const bps =
    region === "domestic_us"
      ? parseEnvInt("STRIPE_CHECKOUT_SURCHARGE_US_BPS", 290)
      : parseEnvInt("STRIPE_CHECKOUT_SURCHARGE_INTL_BPS", 390);
  const flat =
    region === "domestic_us"
      ? parseEnvInt("STRIPE_CHECKOUT_SURCHARGE_US_FIXED_CENTS", 30)
      : parseEnvInt("STRIPE_CHECKOUT_SURCHARGE_INTL_FIXED_CENTS", 30);

  if (bps < 0 || flat < 0) return 0;

  const variable = Math.round((merchandiseSubtotalCents * bps) / 10_000);
  const raw = variable + flat;
  if (raw <= 0) return 0;
  return raw < MIN_CHECKOUT_LINE_CENTS ? MIN_CHECKOUT_LINE_CENTS : raw;
}
