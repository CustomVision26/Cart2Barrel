import {
  BUDGET_BARREL_MAX_BUDGET_CENTS,
  BUDGET_BARREL_MIN_BUDGET_CENTS,
} from "@/lib/budget-barrel/constants";

/** Parse a merchandise dollar input into integer cents. Rejects blank and extra precision. */
export function dollarsInputToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(cents)) return null;
  if (cents < BUDGET_BARREL_MIN_BUDGET_CENTS) return null;
  if (cents > BUDGET_BARREL_MAX_BUDGET_CENTS) return null;
  return cents;
}

/** Parse a product price. Allows amounts below the merchandise-budget minimum. */
export function productPriceInputToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(cents) || cents < 1 || cents > BUDGET_BARREL_MAX_BUDGET_CENTS) return null;
  return cents;
}

export function centsToDollarInput(cents: number | null): string {
  if (cents == null || cents < 0) return "";
  return (cents / 100).toFixed(2);
}

export function usdAmountToCents(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function lineMerchandiseCents(
  priceCents: number | null,
  currency: "USD" | null,
  quantity: number,
): number | null {
  if (priceCents == null || priceCents <= 0) return null;
  if (currency !== "USD") return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return priceCents * quantity;
}
