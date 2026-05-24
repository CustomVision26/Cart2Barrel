import type { MerchantServiceTierRow } from "@/lib/admin-markup";
import { formatUsd } from "@/lib/admin-markup";

export type ServiceHandlingFeeChartRow = {
  unitPriceRangeLabel: string;
  feePerUnitLabel: string;
};

/** Human-readable rows for the public service & handling fee chart. */
export function buildServiceHandlingFeeChartRows(
  tiers: readonly MerchantServiceTierRow[],
): ServiceHandlingFeeChartRow[] {
  const sorted = [...tiers].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );

  return sorted.map((tier, index) => {
    const prevMax = index > 0 ? sorted[index - 1]!.maxUnitPriceInclusiveCents : 0;
    const minCents = prevMax + 1;
    const maxCents = tier.maxUnitPriceInclusiveCents;
    const isOpenEnded = maxCents > 500_00;

    const unitPriceRangeLabel =
      isOpenEnded ?
        `${formatUsd(minCents)} and above`
      : index === 0 ?
        `${formatUsd(1)} – ${formatUsd(maxCents)}`
      : `${formatUsd(minCents)} – ${formatUsd(maxCents)}`;

    return {
      unitPriceRangeLabel,
      feePerUnitLabel: `${formatUsd(tier.feePerUnitCents)} / item`,
    };
  });
}
