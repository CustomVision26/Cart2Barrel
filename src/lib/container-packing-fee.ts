import {
  CARGO_BOX_PACKING_SIZES,
  containerKindChargesPackingFee,
  parseCargoBoxPackingSize,
  type CargoBoxPackingSize,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";


export type CargoBoxPackingRate = {
  singlePackingFeeCents: number;
  multiPackingPerUnitCents: number;
};

export type CargoBoxPackingRates = Partial<
  Record<CargoBoxPackingSize, CargoBoxPackingRate>
>;

export type CargoBoxPackingCounts = Partial<Record<CargoBoxPackingSize, number>>;

export type ContainerPackingFeeRecord = {
  id: string;
  containerKind: Extract<ContainerOfferingKind, "barrel" | "bin" | "cargo_box">;
  cargoBoxSize: CargoBoxPackingSize | null;
  singleFeeCents: number;
  multiFeeCents: number;
  publishedAt: string | null;
  updatedAt: string;
};

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
  cargoBoxRates?: CargoBoxPackingRates;
};

export const DEFAULT_CONTAINER_PACKING_RATES: ContainerPackingRates = {
  singleBarrelPackingFeeCents: 10_000,
  multiBarrelPackingPerUnitCents: 8_000,
  singleBinPackingFeeCents: 5_500,
  multiBinPackingPerUnitCents: 4_500,
  cargoBoxRates: {},
};

function cargoBoxRatesOf(rates: ContainerPackingRates): CargoBoxPackingRates {
  return rates.cargoBoxRates ?? {};
}

function mergeCargoBoxRates(
  primary: CargoBoxPackingRates,
  fallback: CargoBoxPackingRates,
): CargoBoxPackingRates {
  const out: CargoBoxPackingRates = { ...fallback };
  for (const size of CARGO_BOX_PACKING_SIZES) {
    const row = primary[size];
    if (!row) continue;
    out[size] = {
      singlePackingFeeCents: Math.max(0, row.singlePackingFeeCents),
      multiPackingPerUnitCents: Math.max(0, row.multiPackingPerUnitCents),
    };
  }
  return out;
}

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
    cargoBoxRates: mergeCargoBoxRates(
      cargoBoxRatesOf(primary),
      cargoBoxRatesOf(fallback),
    ),
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
  cargoBoxCounts: CargoBoxPackingCounts;
  cargoBoxPackingBySize: Partial<Record<CargoBoxPackingSize, number>>;
  cargoBoxPackingFeeCents: number;
  totalPackingFeeCents: number;
};

export function emptyCargoBoxCounts(): CargoBoxPackingCounts {
  return {};
}

export function addCargoBoxCount(
  counts: CargoBoxPackingCounts,
  sizeLabel: string | null | undefined,
  quantity: number,
): CargoBoxPackingCounts {
  const size = parseCargoBoxPackingSize(sizeLabel);
  const qty = Math.max(0, Math.floor(quantity));
  if (!size || qty === 0) return counts;
  return { ...counts, [size]: (counts[size] ?? 0) + qty };
}

export function cargoBoxCountsFromLines(
  rows: {
    kind: ContainerOfferingKind;
    quantity: number;
    sizeLabel?: string | null;
  }[],
): CargoBoxPackingCounts {
  let counts: CargoBoxPackingCounts = {};
  for (const row of rows) {
    if (row.kind !== "cargo_box" || row.quantity <= 0) continue;
    counts = addCargoBoxCount(counts, row.sizeLabel, row.quantity);
  }
  return counts;
}

function countForSize(
  counts: CargoBoxPackingCounts | undefined,
  size: CargoBoxPackingSize,
): number {
  return Math.max(0, Math.floor(counts?.[size] ?? 0));
}

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

export function cargoBoxPackingFeeCents(
  count: number,
  rate: CargoBoxPackingRate | undefined,
): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0 || !rate) return 0;
  if (n === 1) return Math.max(0, rate.singlePackingFeeCents);
  return n * Math.max(0, rate.multiPackingPerUnitCents);
}

export function computeCargoBoxPackingFeeCents(
  counts: CargoBoxPackingCounts | undefined,
  rates: ContainerPackingRates,
): number {
  const boxRates = cargoBoxRatesOf(rates);
  let total = 0;
  for (const size of CARGO_BOX_PACKING_SIZES) {
    total += cargoBoxPackingFeeCents(countForSize(counts, size), boxRates[size]);
  }
  return total;
}

export function computeContainerPackingFeeBreakdown(
  barrelCount: number,
  binCount: number,
  rates?: ContainerPackingRates | null,
  cargoBoxCounts?: CargoBoxPackingCounts,
): ContainerPackingFeeBreakdown {
  const r = withDefaultContainerPackingRates(
    rates ?? DEFAULT_CONTAINER_PACKING_RATES,
  );
  const barrelPacking = barrelPackingFeeCents(barrelCount, r);
  const binPacking = binPackingFeeCents(binCount, r);
  const boxes = cargoBoxCounts ?? {};
  const boxRates = cargoBoxRatesOf(r);
  const cargoBoxPackingBySize: Partial<Record<CargoBoxPackingSize, number>> = {};
  let cargoPacking = 0;
  for (const size of CARGO_BOX_PACKING_SIZES) {
    const fee = cargoBoxPackingFeeCents(countForSize(boxes, size), boxRates[size]);
    if (fee > 0) cargoBoxPackingBySize[size] = fee;
    cargoPacking += fee;
  }
  return {
    barrelCount: Math.max(0, Math.floor(barrelCount)),
    binCount: Math.max(0, Math.floor(binCount)),
    barrelPackingFeeCents: barrelPacking,
    binPackingFeeCents: binPacking,
    cargoBoxCounts: boxes,
    cargoBoxPackingBySize,
    cargoBoxPackingFeeCents: cargoPacking,
    totalPackingFeeCents: barrelPacking + binPacking + cargoPacking,
  };
}

export function containerPackingPerUnitCentsForKind(
  kind: ContainerOfferingKind,
  barrelCount: number,
  binCount: number,
  rates: ContainerPackingRates,
  options?: {
    sizeLabel?: string | null;
    cargoBoxCounts?: CargoBoxPackingCounts;
  },
): number {
  if (!containerKindChargesPackingFee(kind)) return 0;
  const r = withDefaultContainerPackingRates(rates);
  if (kind === "barrel") {
    const n = Math.max(0, Math.floor(barrelCount));
    if (n === 0) return 0;
    if (n === 1) return r.singleBarrelPackingFeeCents;
    return r.multiBarrelPackingPerUnitCents;
  }
  if (kind === "cargo_box") {
    const size = parseCargoBoxPackingSize(options?.sizeLabel);
    if (!size) return 0;
    const rate = cargoBoxRatesOf(r)[size];
    if (!rate) return 0;
    const n = countForSize(options?.cargoBoxCounts, size);
    if (n === 0) return 0;
    if (n === 1) return rate.singlePackingFeeCents;
    return rate.multiPackingPerUnitCents;
  }
  const n = Math.max(0, Math.floor(binCount));
  if (n === 0) return 0;
  if (n === 1) return r.singleBinPackingFeeCents;
  return r.multiBinPackingPerUnitCents;
}

export function containerPackingPerUnitCentsFromBreakdown(
  kind: ContainerOfferingKind,
  breakdown: ContainerPackingFeeBreakdown,
  sizeLabel?: string | null,
): number {
  if (!containerKindChargesPackingFee(kind)) return 0;
  if (kind === "barrel") {
    if (breakdown.barrelCount <= 0) return 0;
    return Math.round(breakdown.barrelPackingFeeCents / breakdown.barrelCount);
  }
  if (kind === "cargo_box") {
    const size = parseCargoBoxPackingSize(sizeLabel);
    if (!size) return 0;
    const count = countForSize(breakdown.cargoBoxCounts, size);
    if (count <= 0) return 0;
    const fee = breakdown.cargoBoxPackingBySize[size] ?? 0;
    return Math.round(fee / count);
  }
  if (breakdown.binCount <= 0) return 0;
  return Math.round(breakdown.binPackingFeeCents / breakdown.binCount);
}

export function allocateContainerPackingFeeToLineCents(params: {
  kind: ContainerOfferingKind;
  quantity: number;
  barrelCount: number;
  binCount: number;
  rates: ContainerPackingRates;
  sizeLabel?: string | null;
  cargoBoxCounts?: CargoBoxPackingCounts;
}): number {
  const qty = Math.max(0, Math.floor(params.quantity));
  if (qty === 0 || !containerKindChargesPackingFee(params.kind)) return 0;

  const perUnit = containerPackingPerUnitCentsForKind(
    params.kind,
    params.barrelCount,
    params.binCount,
    params.rates,
    {
      sizeLabel: params.sizeLabel,
      cargoBoxCounts: params.cargoBoxCounts,
    },
  );
  if (perUnit <= 0) return 0;
  return perUnit * qty;
}
