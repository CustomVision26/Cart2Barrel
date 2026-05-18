/** Admin-configured container packing rates (all amounts in cents). */
export type ContainerPackingRates = {
  /** Total fee when cart has exactly one barrel. */
  singleBarrelPackingFeeCents: number;
  /** Per-barrel fee when cart has two or more barrels. */
  multiBarrelPackingPerUnitCents: number;
  /** Total fee when cart has exactly one bin. */
  singleBinPackingFeeCents: number;
  /** Per-bin fee when cart has two or more bins. */
  multiBinPackingPerUnitCents: number;
};

export const DEFAULT_CONTAINER_PACKING_RATES: ContainerPackingRates = {
  singleBarrelPackingFeeCents: 10_000,
  multiBarrelPackingPerUnitCents: 8_000,
  singleBinPackingFeeCents: 5_500,
  multiBinPackingPerUnitCents: 4_500,
};

/** Use `fallback` for any rate field that is zero or missing on `primary`. */
export function mergeContainerPackingRates(
  primary: ContainerPackingRates,
  fallback: ContainerPackingRates,
): ContainerPackingRates {
  return {
    singleBarrelPackingFeeCents:
      primary.singleBarrelPackingFeeCents > 0 ?
        primary.singleBarrelPackingFeeCents
      : fallback.singleBarrelPackingFeeCents,
    multiBarrelPackingPerUnitCents:
      primary.multiBarrelPackingPerUnitCents > 0 ?
        primary.multiBarrelPackingPerUnitCents
      : fallback.multiBarrelPackingPerUnitCents,
    singleBinPackingFeeCents:
      primary.singleBinPackingFeeCents > 0 ?
        primary.singleBinPackingFeeCents
      : fallback.singleBinPackingFeeCents,
    multiBinPackingPerUnitCents:
      primary.multiBinPackingPerUnitCents > 0 ?
        primary.multiBinPackingPerUnitCents
      : fallback.multiBinPackingPerUnitCents,
  };
}

export function withDefaultContainerPackingRates(
  rates: ContainerPackingRates,
): ContainerPackingRates {
  return mergeContainerPackingRates(rates, DEFAULT_CONTAINER_PACKING_RATES);
}

export type ContainerPackingFeeBreakdown = {
  barrelCount: number;
  binCount: number;
  barrelPackingFeeCents: number;
  binPackingFeeCents: number;
  totalPackingFeeCents: number;
};

/** Fee for barrel quantity using single vs multi rate. */
export function barrelPackingFeeCents(
  barrelCount: number,
  rates: ContainerPackingRates,
): number {
  const n = Math.max(0, Math.floor(barrelCount));
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, rates.singleBarrelPackingFeeCents);
  return n * Math.max(0, rates.multiBarrelPackingPerUnitCents);
}

/** Fee for bin quantity using single vs multi rate. */
export function binPackingFeeCents(
  binCount: number,
  rates: ContainerPackingRates,
): number {
  const n = Math.max(0, Math.floor(binCount));
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, rates.singleBinPackingFeeCents);
  return n * Math.max(0, rates.multiBinPackingPerUnitCents);
}

export function computeContainerPackingFeeBreakdown(
  barrelCount: number,
  binCount: number,
  rates?: ContainerPackingRates | null,
): ContainerPackingFeeBreakdown {
  const r = withDefaultContainerPackingRates(rates ?? DEFAULT_CONTAINER_PACKING_RATES);
  const barrelPacking = barrelPackingFeeCents(barrelCount, r);
  const binPacking = binPackingFeeCents(binCount, r);
  return {
    barrelCount: Math.max(0, Math.floor(barrelCount)),
    binCount: Math.max(0, Math.floor(binCount)),
    barrelPackingFeeCents: barrelPacking,
    binPackingFeeCents: binPacking,
    totalPackingFeeCents: barrelPacking + binPacking,
  };
}

/** Per-container packaging rate for one kind from cart totals (single vs multi tier). */
export function containerPackingPerUnitCentsForKind(
  kind: "barrel" | "bin",
  barrelCount: number,
  binCount: number,
  rates: ContainerPackingRates,
): number {
  const r = withDefaultContainerPackingRates(rates);
  if (kind === "barrel") {
    const n = Math.max(0, Math.floor(barrelCount));
    if (n === 0) return 0;
    if (n === 1) return r.singleBarrelPackingFeeCents;
    return r.multiBarrelPackingPerUnitCents;
  }
  const n = Math.max(0, Math.floor(binCount));
  if (n === 0) return 0;
  if (n === 1) return r.singleBinPackingFeeCents;
  return r.multiBinPackingPerUnitCents;
}

/** Per-container packaging rate implied by the cart-wide breakdown (single vs multi tier). */
export function containerPackingPerUnitCentsFromBreakdown(
  kind: "barrel" | "bin",
  breakdown: ContainerPackingFeeBreakdown,
): number {
  if (kind === "barrel") {
    if (breakdown.barrelCount <= 0) return 0;
    return Math.round(breakdown.barrelPackingFeeCents / breakdown.barrelCount);
  }
  if (breakdown.binCount <= 0) return 0;
  return Math.round(breakdown.binPackingFeeCents / breakdown.binCount);
}

/** Line packaging = per-unit rate × line quantity (e.g. 2 barrels × $160 = $320). */
export function allocateContainerPackingFeeToLineCents(params: {
  kind: "barrel" | "bin";
  quantity: number;
  barrelCount: number;
  binCount: number;
  rates: ContainerPackingRates;
}): number {
  const qty = Math.max(0, Math.floor(params.quantity));
  if (qty === 0) return 0;

  const perUnit = containerPackingPerUnitCentsForKind(
    params.kind,
    params.barrelCount,
    params.binCount,
    params.rates,
  );
  if (perUnit <= 0) return 0;
  return perUnit * qty;
}
