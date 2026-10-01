import { Info, ShoppingBag, Store } from "lucide-react";
import type { CSSProperties } from "react";

import { PricingOverviewSection } from "@/components/marketing/how-it-works-pricing-overview";
import type { ServiceHandlingFeeChartRow } from "@/lib/service-handling-fee-chart";

type ServiceHandlingFeeChartProps = {
  rows: ServiceHandlingFeeChartRow[];
  kind?: "in-app" | "outside";
  index?: number;
};

const CHART_COPY = {
  "in-app": {
    title: "In-app service & handling",
    description:
      "Our fee for items you request through Amani Cart2Barrel (we purchase on your behalf). Based on each product's unit price—multiply by quantity on the line.",
    footer:
      "Published rates may change over time. After you sign in, your account may show in-app tiers tailored to your customer package.",
    icon: <ShoppingBag className="size-4" />,
  },
  outside: {
    title: "Outside purchase service & handling",
    description:
      "When you buy from a retailer yourself and ship to our hub, you pay this fee only—not in-app merchandise, shipping, or in-app service fees. Based on the listed unit price on your receipt × consumer units.",
    footer:
      "Outside-purchase tiers are published globally and are not replaced by in-app or customer-package rates.",
    icon: <Store className="size-4" />,
  },
} as const;

export function ServiceHandlingFeeChart({
  rows,
  kind = "in-app",
  index = kind === "in-app" ? 1 : 2,
}: ServiceHandlingFeeChartProps) {
  const copy = CHART_COPY[kind];

  return (
    <PricingOverviewSection
      index={index}
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      footer={
        <p className="inline-flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {copy.footer}
        </p>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border/60 bg-muted/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Unit price range</span>
          <span className="text-right">Fee</span>
        </div>
        <ul>
          {rows.map((row, rowIndex) => (
            <li
              key={row.unitPriceRangeLabel}
              className="pricing-overview-row grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-xs transition-colors"
              style={
                {
                  "--pricing-row-index": rowIndex,
                } as CSSProperties
              }
            >
              <span className="font-medium text-foreground">
                {row.unitPriceRangeLabel}
              </span>
              <span className="text-right tabular-nums font-semibold text-primary">
                {row.feePerUnitLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PricingOverviewSection>
  );
}
