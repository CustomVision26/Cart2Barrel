import { Info } from "lucide-react";

import type { ServiceHandlingFeeChartRow } from "@/lib/service-handling-fee-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ServiceHandlingFeeChartProps = {
  rows: ServiceHandlingFeeChartRow[];
  /** Which fee schedule this table represents. */
  kind?: "in-app" | "outside";
};

const CHART_COPY = {
  "in-app": {
    title: "In-app service & handling",
    description:
      "Our fee for items you request through Cart2Barrel (we purchase on your behalf). Based on each product's unit price—multiply by quantity on the line.",
    footer:
      "Published rates may change over time. After you sign in, your account may show in-app tiers tailored to your customer package.",
  },
  outside: {
    title: "Outside purchase service & handling",
    description:
      "When you buy from a retailer yourself and ship to our hub, you pay this fee only—not in-app merchandise, shipping, or in-app service fees. Based on the listed unit price on your receipt × consumer units.",
    footer:
      "Outside-purchase tiers are published globally and are not replaced by in-app or customer-package rates.",
  },
} as const;

export function ServiceHandlingFeeChart({
  rows,
  kind = "in-app",
}: ServiceHandlingFeeChartProps) {
  const copy = CHART_COPY[kind];

  return (
    <Card className="border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="font-heading text-base">{copy.title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {copy.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Unit price range</span>
            <span className="text-right">Fee</span>
          </div>
          <ul>
            {rows.map((row, index) => (
              <li
                key={row.unitPriceRangeLabel}
                className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 text-xs ${
                  index % 2 === 0 ? "bg-background/40" : "bg-muted/20"
                }`}
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
        <p className="inline-flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {copy.footer}
        </p>
      </CardContent>
    </Card>
  );
}
