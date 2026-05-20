import type { ReactNode } from "react";

import { BarrelPipelineProductCard } from "@/components/barrels/barrel-pipeline-product-card";
import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
import { barrelPipelineProductGridClassName } from "@/lib/barrel-pipeline-product-display";

type BarrelPipelineProductSectionsProps = {
  lines: BarrelPipelineProductDisplayRow[];
  isAssigned: (row: BarrelPipelineProductDisplayRow) => boolean;
  orderIdHint?: boolean;
  emptyMessage: string;
  renderCardFooter?: (row: BarrelPipelineProductDisplayRow) => ReactNode;
};

export function BarrelPipelineProductSections({
  lines,
  isAssigned,
  orderIdHint = false,
  emptyMessage,
  renderCardFooter,
}: BarrelPipelineProductSectionsProps) {
  const awaiting = lines.filter((row) => !isAssigned(row));
  const assigned = lines.filter((row) => isAssigned(row));

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {awaiting.length > 0 ?
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Awaiting assignment ({awaiting.length})
          </h3>
          <div className={barrelPipelineProductGridClassName}>
            {awaiting.map((row) => (
              <BarrelPipelineProductCard
                key={row.packageId}
                row={row}
                isAssigned={false}
                orderIdHint={orderIdHint}
                footer={renderCardFooter?.(row)}
              />
            ))}
          </div>
        </div>
      : null}

      {assigned.length > 0 ?
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Assigned to container ({assigned.length})
          </h3>
          <div className={barrelPipelineProductGridClassName}>
            {assigned.map((row) => (
              <BarrelPipelineProductCard
                key={row.packageId}
                row={row}
                isAssigned
                orderIdHint={orderIdHint}
                footer={renderCardFooter?.(row)}
              />
            ))}
          </div>
        </div>
      : null}
    </div>
  );
}
