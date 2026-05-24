import { Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ContainerPackingFeeChartRow } from "@/lib/container-packing-fee-chart";

type ContainerPackingFeeChartProps = {
  rows: ContainerPackingFeeChartRow[];
};

export function ContainerPackingFeeChart({ rows }: ContainerPackingFeeChartProps) {
  return (
    <Card className="border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="font-heading text-base">Packing fees</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Packaging charges when barrels or bins are in your cart. One container
          uses a flat fee; ordering more of the same type uses a per-unit rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>In your cart</span>
            <span className="text-right">Packing fee</span>
          </div>
          <ul>
            {rows.map((row, index) => (
              <li
                key={row.containerLabel}
                className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 text-xs ${
                  index % 2 === 0 ? "bg-background/40" : "bg-muted/20"
                }`}
              >
                <span className="font-medium text-foreground">
                  {row.containerLabel}
                </span>
                <span className="text-right tabular-nums font-semibold text-primary">
                  {row.chargeLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="inline-flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          Barrel and bin counts are added separately at checkout. Mixed carts
          include both kinds when applicable.
        </p>
      </CardContent>
    </Card>
  );
}
