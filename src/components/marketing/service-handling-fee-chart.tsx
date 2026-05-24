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
};

export function ServiceHandlingFeeChart({ rows }: ServiceHandlingFeeChartProps) {
  return (
    <Card className="border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="font-heading text-base">
          Service &amp; handling fee
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Per-unit fee by product price (USD). Multiply by quantity on each line.
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
          Published tiers may be updated in admin settings. Your signed-in account
          may use custom tiers when assigned.
        </p>
      </CardContent>
    </Card>
  );
}
