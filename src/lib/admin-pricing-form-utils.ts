import type { ContainerPackingRates } from "@/lib/container-packing-fee";

export type FeeTierFormRow = {
  minUnitPriceInclusiveCents: number;
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

export type FeeTierServerPayload = {
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

const OPEN_ENDED_MAX_THRESHOLD_CENTS = 1_000_000_000;

export function centsToUsdInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function parseUsdToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function isOpenEndedMax(maxCents: number): boolean {
  return maxCents >= OPEN_ENDED_MAX_THRESHOLD_CENTS;
}

export function sortTierRows(rows: FeeTierFormRow[]): FeeTierFormRow[] {
  return [...rows].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
}

export function serverTiersToFormRows(db: FeeTierServerPayload[]): FeeTierFormRow[] {
  const sorted = [...db].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
  return sorted.map((t, i) => ({
    minUnitPriceInclusiveCents:
      i === 0 ? 1 : sorted[i - 1]!.maxUnitPriceInclusiveCents + 1,
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));
}

export function containerRatesToFormState(r: ContainerPackingRates) {
  return {
    singleBarrelDollars: centsToUsdInput(r.singleBarrelPackingFeeCents),
    multiBarrelDollars: centsToUsdInput(r.multiBarrelPackingPerUnitCents),
    singleBinDollars: centsToUsdInput(r.singleBinPackingFeeCents),
    multiBinDollars: centsToUsdInput(r.multiBinPackingPerUnitCents),
  };
}

export function formStateToContainerRates(state: {
  singleBarrelDollars: string;
  multiBarrelDollars: string;
  singleBinDollars: string;
  multiBinDollars: string;
}): ContainerPackingRates {
  return {
    singleBarrelPackingFeeCents: parseUsdToCents(state.singleBarrelDollars),
    multiBarrelPackingPerUnitCents: parseUsdToCents(state.multiBarrelDollars),
    singleBinPackingFeeCents: parseUsdToCents(state.singleBinDollars),
    multiBinPackingPerUnitCents: parseUsdToCents(state.multiBinDollars),
  };
}

export function validateTiers(sorted: FeeTierFormRow[]): string | null {
  let openEndedCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (isOpenEndedMax(r.maxUnitPriceInclusiveCents)) {
      openEndedCount += 1;
      if (i !== sorted.length - 1) {
        return "Only the last tier may use an open-ended maximum.";
      }
    }
    if (r.maxUnitPriceInclusiveCents < r.minUnitPriceInclusiveCents) {
      return `Tier ${i + 1}: “through” must be at least “from”.`;
    }
  }
  if (openEndedCount === 0) {
    return "The last tier must use an open-ended maximum (system max).";
  }
  return null;
}

export function patchMaxAndSyncNextMin(
  rows: FeeTierFormRow[],
  target: FeeTierFormRow,
  newMax: number,
): FeeTierFormRow[] {
  const sorted = sortTierRows(rows);
  const idx = sorted.findIndex((r) => r === target);
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  return sortTierRows(
    rows.map((r) => {
      if (r === target) return { ...r, maxUnitPriceInclusiveCents: newMax };
      if (next && r === next) {
        return { ...r, minUnitPriceInclusiveCents: newMax + 1 };
      }
      return r;
    }),
  );
}
