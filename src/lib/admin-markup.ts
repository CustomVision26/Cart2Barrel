/**
 * Admin-configurable knobs (env): tax (bps), flat shipping cents.
 * Service & handling tiers and packing fee can be edited in
 * `/admin/overview?tab=set-fee-n-rate` (stored in Postgres); this module holds defaults and math.
 */

export type AdminMarkupSettings = {
  /** Tax applied to merchandise + shipping + service + packing (simplified). */
  taxBps: number;
  /** Flat estimated outbound shipping in cents (per line / MVP). */
  defaultShippingCents: number;
};

/** One row from `service_handling_fee_tiers` (or the built-in default ladder). */
export type MerchantServiceTierRow = {
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

/** Matches legacy hardcoded tiers; used when DB has no rows yet. */
export const DEFAULT_MERCHANT_SERVICE_TIERS: readonly MerchantServiceTierRow[] =
  [
    { maxUnitPriceInclusiveCents: 2000, feePerUnitCents: 50 },
    { maxUnitPriceInclusiveCents: 4000, feePerUnitCents: 100 },
    { maxUnitPriceInclusiveCents: 8000, feePerUnitCents: 150 },
    { maxUnitPriceInclusiveCents: 10000, feePerUnitCents: 200 },
    { maxUnitPriceInclusiveCents: 20000, feePerUnitCents: 300 },
    { maxUnitPriceInclusiveCents: 2_147_483_647, feePerUnitCents: 500 },
  ] as const;

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

function resolveTiers(
  tiers?: readonly MerchantServiceTierRow[] | null,
): readonly MerchantServiceTierRow[] {
  return tiers && tiers.length > 0 ? tiers : DEFAULT_MERCHANT_SERVICE_TIERS;
}

/**
 * Service & handling fee in cents for **one** item, from its unit price (cents),
 * using tier rows sorted ascending by `maxUnitPriceInclusiveCents`.
 */
export function serviceHandlingFeePerUnitCents(
  unitPriceCents: number,
  tiers?: readonly MerchantServiceTierRow[] | null,
): number {
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) return 0;
  const list = [...resolveTiers(tiers)].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
  for (const row of list) {
    if (unitPriceCents <= row.maxUnitPriceInclusiveCents) {
      return row.feePerUnitCents;
    }
  }
  const last = list[list.length - 1];
  return last ? last.feePerUnitCents : 0;
}

/** Optional DB-backed tiers + packing for line estimates. */
export type LineEstimateFeeOptions = {
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
  /** Added once per line (not multiplied by quantity). */
  packingFeePerLineCents?: number | null;
};

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
  /** When set, overrides default tier ladder for service fee only. */
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
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
          serviceHandlingFeePerUnitCents(
            effectiveConsumerUnitCents,
            input.serviceTiers,
          ) * consumerUnits
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
  /** Flat packing once per quoted line (cents). */
  packingFeeCents: number;
  estimatedShippingCents: number;
  taxCents: number;
  totalCents: number | null;
};

/**
 * Merchandise = unit × qty. Service = per-unit tier fee × qty. Shipping flat.
 * Tax = bps × (merchandise + service + shipping). Per-line packing is not in estimates.
 */
export function computeLineEstimateCents(
  unitPriceCents: number | null,
  quantity: number,
  settings: AdminMarkupSettings,
  feeOptions?: LineEstimateFeeOptions | null,
): LineEstimateCents {
  const estimatedShippingCents = settings.defaultShippingCents;
  const packingFeeCents = 0;

  if (unitPriceCents == null || unitPriceCents < 0) {
    return {
      quantity,
      unitPriceCents: null,
      merchandiseSubtotalCents: null,
      serviceFeeCents: null,
      packingFeeCents,
      estimatedShippingCents,
      taxCents: 0,
      totalCents: null,
    };
  }

  const merchandiseSubtotalCents = Math.round(unitPriceCents * quantity);
  const perUnit = serviceHandlingFeePerUnitCents(
    unitPriceCents,
    feeOptions?.serviceTiers,
  );
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
    packingFeeCents,
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
