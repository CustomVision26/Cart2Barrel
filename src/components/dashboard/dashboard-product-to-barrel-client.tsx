"use client";

import { ContainerSlotsInventorySection } from "@/components/barrels/container-slots-inventory-section";
import { BarrelPipelineProductSections } from "@/components/barrels/barrel-pipeline-product-sections";
import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
import type {
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";

export type DashboardProductToBarrelClientProps = {
  lines: ProductToBarrelLineRow[];
  barrels: UserBarrelOptionRow[];
};

function isLineAssigned(row: BarrelPipelineProductDisplayRow): boolean {
  return Boolean(row.assignedContainerAlias?.trim());
}

export function DashboardProductToBarrelClient({
  lines,
  barrels,
}: DashboardProductToBarrelClientProps) {
  const awaitingCount = lines.filter((row) => !isLineAssigned(row)).length;
  const assignedCount = lines.length - awaitingCount;

  return (
    <div className="space-y-4">
      <ContainerSlotsInventorySection barrels={barrels} />

      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Staff assign products to your paid containers. This page is read-only — you can see
        fulfillment status, container alias, and when each assignment was made. Changes appear
        on{" "}
        <span className="font-medium text-foreground">Product to barrel history</span>.
      </p>

      {lines.length > 0 ?
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {awaitingCount} awaiting
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {assignedCount} assigned
          </span>
        </div>
      : null}

      <BarrelPipelineProductSections
        lines={lines}
        isAssigned={isLineAssigned}
        orderIdHint
        emptyMessage="Nothing is in the barrel packing queue right now. Outside purchases paid at checkout and warehouse receipts in good condition appear here when staff are ready to assign containers."
      />
    </div>
  );
}
