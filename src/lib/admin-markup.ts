/**
 * Admin-configurable knobs (env): tax (bps), flat shipping cents.
 * Service & handling uses fixed **per-unit USD tiers** (see `.cursor/rules/cart2barrel-service-handling-fees.mdc`).
 */

export type AdminMarkupSettings = {
  /** Tax applied to merchandise + shipping + service (simplified). */
  taxBps: number;
  /** Flat estimated outbound shipping in cents (per line / MVP). */
  defaultShippingCents: number;
};

function parseBps(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 50_000) return fallback;
  return n;
}

function parseCents(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 5_000_000) return fallback;
  return n;
}

export function getAdminMarkupSettings(): AdminMarkupSettings {
  return {
    taxBps: parseBps(process.env.ADMIN_TAX_BPS, 0),
    defaultShippingCents: parseCents(process.env.ADMIN_DEFAULT_SHIPPING_CENTS, 1500),
  };
}

/**
 * Service & handling fee in cents for **one** item, from its unit price (cents).
 * Tiers match Cart2Barrel product rules (USD).
 */
export function serviceHandlingFeePerUnitCents(unitPriceCents: number): number {
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) return 0;
  if (unitPriceCents <= 2000) return 50;
  if (unitPriceCents <= 4000) return 100;
  if (unitPriceCents <= 8000) return 150;
  if (unitPriceCents <= 10000) return 200;
  if (unitPriceCents <= 20000) return 300;
  return 500;
}

/** Inputs for pack/bundle/case lines (merchandise and tiered service). */
export type PackLinePricingInput = {
  /** Listed price for one pack (single SKU, bundle, or case), cents. */
  packPriceCents: number;
  /** Number of packs at that price (e.g. cases or bundle lines ordered). */
  packCount: number;
  /**
   * Consumer units included in one pack (1 = each pack is one unit;
   * 2 = twin-pack; 10 = case of 10). Used to infer fee tier per consumer unit.
   */
  unitsPerPack: number;
  /**
   * When the retailer shows a different consumer-unit price than pack ÷ units,
   * set this (cents) for **service & handling tiers only**. Merchandise stays
   * pack price × pack count. When null/omit, tiers use implied unit from pack.
   */
  consumerUnitPriceOverrideCents?: number | null;
};

export type PackLinePricingResult = {
  /** Listed pack price × pack count (reference subtotal). */
  packBundleSubtotalCents: number;
  /** Line merchandise saved on the quote (always pack line when pack price in use). */
  merchandiseSubtotalCents: number;
  serviceFeeCents: number;
  /** Unit price used for service tier math (override if set, else implied from pack). */
  effectiveConsumerUnitCents: number;
  usesConsumerUnitOverride: boolean;
  impliedConsumerUnitCents: number;
};

/**
 * Merchandise = pack price × pack count only. Optional consumer-unit override
 * adjusts service fee tiers only (not merchandise subtotal).
 */
export function computePackLineMerchandiseAndServiceCents(
  input: PackLinePricingInput
): PackLinePricingResult {
  const packCount = Math.max(0, Math.floor(input.packCount));
  const packPrice = Math.max(0, input.packPriceCents);
  const upp = Math.max(
    1,
    Math.min(9999, Math.floor(Number(input.unitsPerPack) || 1))
  );

  const packBundleSubtotalCents = Math.round(packPrice * packCount);
  const consumerUnits = packCount * upp;
  const impliedConsumerUnitCents =
    upp > 0 && packPrice > 0 ? Math.round(packPrice / upp) : 0;

  const raw = input.consumerUnitPriceOverrideCents;
  const override =
    raw != null && Number.isFinite(raw) && Math.round(raw) > 0
      ? Math.round(raw)
      : null;
  const usesConsumerUnitOverride = override != null;

  const effectiveConsumerUnitCents = usesConsumerUnitOverride
    ? (override as number)
    : impliedConsumerUnitCents;

  const merchandiseSubtotalCents = packBundleSubtotalCents;

  const serviceFeeCents =
    effectiveConsumerUnitCents > 0 && consumerUnits > 0
      ? Math.round(
          serviceHandlingFeePerUnitCents(effectiveConsumerUnitCents) *
            consumerUnits
        )
      : 0;

  return {
    packBundleSubtotalCents,
    merchandiseSubtotalCents,
    serviceFeeCents,
    effectiveConsumerUnitCents,
    usesConsumerUnitOverride,
    impliedConsumerUnitCents,
  };
}

export type LineEstimateCents = {
  quantity: number;
  unitPriceCents: number | null;
  merchandiseSubtotalCents: number | null;
  serviceFeeCents: number | null;
  estimatedShippingCents: number;
  taxCents: number;
  totalCents: number | null;
};

/**
 * Merchandise = unit × qty. Service = per-unit tier fee × qty. Shipping flat.
 * Tax = bps × (merchandise + service + shipping).
 */
export function computeLineEstimateCents(
  unitPriceCents: number | null,
  quantity: number,
  settings: AdminMarkupSettings
): LineEstimateCents {
  const estimatedShippingCents = settings.defaultShippingCents;

  if (unitPriceCents == null || unitPriceCents < 0) {
    return {
      quantity,
      unitPriceCents: null,
      merchandiseSubtotalCents: null,
      serviceFeeCents: null,
      estimatedShippingCents,
      taxCents: 0,
      totalCents: null,
    };
  }

  const merchandiseSubtotalCents = Math.round(unitPriceCents * quantity);
  const perUnit = serviceHandlingFeePerUnitCents(unitPriceCents);
  const serviceFeeCents = Math.round(perUnit * quantity);
  const preTax =
    merchandiseSubtotalCents + serviceFeeCents + estimatedShippingCents;
  const taxCents =
    settings.taxBps > 0 ? Math.round((preTax * settings.taxBps) / 10_000) : 0;
  const totalCents = preTax + taxCents;

  return {
    quantity,
    unitPriceCents,
    merchandiseSubtotalCents,
    serviceFeeCents,
    estimatedShippingCents,
    taxCents,
    totalCents,
  };
}

export function formatUsd(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
