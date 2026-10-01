import { Info, Package } from "lucide-react";
import type { CSSProperties } from "react";

import { PricingOverviewSection } from "@/components/marketing/how-it-works-pricing-overview";
import type { ContainerPackingFeeChartRow } from "@/lib/container-packing-fee-chart";

type ContainerPackingFeeChartProps = {
  rows: ContainerPackingFeeChartRow[];
  index?: number;
};

export function ContainerPackingFeeChart({
  rows,
  index = 4,
}: ContainerPackingFeeChartProps) {
  return (
    <PricingOverviewSection
      index={index}
      icon={<Package className="size-4" />}
      title="Packing fees"
      description="Packaging charges when barrels or bins are in your cart. One container uses a flat fee; ordering more of the same type uses a per-unit rate."
      accent="emerald"
      footer={
        <p className="inline-flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          Barrel and bin counts are added separately at checkout. Mixed carts
          include both kinds when applicable.
        </p>
      }
    >
      <div className="pricing-overview-ledger overflow-hidden rounded-lg">
        <div className="pricing-overview-ledger-head grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <span>In your cart</span>
          <span className="text-right">Packing fee</span>
        </div>
        <ul>
          {rows.map((row, rowIndex) => (
            <li
              key={row.containerLabel}
              className="pricing-overview-row grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-xs transition-colors"
              style={
                {
                  "--pricing-row-index": rowIndex,
                } as CSSProperties
              }
            >
              <span className="font-medium text-foreground">
                {row.containerLabel}
              </span>
              <span className="pricing-overview-fee text-right tabular-nums font-semibold">
                {row.chargeLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PricingOverviewSection>
  );
}
