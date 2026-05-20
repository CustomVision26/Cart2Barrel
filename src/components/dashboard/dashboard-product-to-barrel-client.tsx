"use client";

import { useMemo, useState } from "react";

import { ContainerSlotsInventorySection } from "@/components/barrels/container-slots-inventory-section";
import { BarrelPipelineProductSections } from "@/components/barrels/barrel-pipeline-product-sections";
import { ProductToBarrelFiltersToolbar } from "@/components/barrels/product-to-barrel-filters-toolbar";
import type {
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
import {
  containerFilterOptionsByAlias,
  DEFAULT_PRODUCT_TO_BARREL_FILTERS,
  filterAndSortPipelineLines,
  isPipelineLineAssigned,
  uniqueFulfillmentStatuses,
  type ProductToBarrelFilterState,
} from "@/lib/product-to-barrel-filters";

export type DashboardProductToBarrelClientProps = {
  lines: ProductToBarrelLineRow[];
  barrels: UserBarrelOptionRow[];
};

export function DashboardProductToBarrelClient({
  lines,
  barrels,
}: DashboardProductToBarrelClientProps) {
  const [filters, setFilters] = useState<ProductToBarrelFilterState>(
    DEFAULT_PRODUCT_TO_BARREL_FILTERS,
  );

  const fulfillmentOptions = useMemo(
    () => uniqueFulfillmentStatuses(lines),
    [lines],
  );
  const containerOptions = useMemo(
    () => containerFilterOptionsByAlias(barrels),
    [barrels],
  );

  const filteredLines = useMemo(
    () => filterAndSortPipelineLines(lines, filters),
    [lines, filters],
  );

  const awaitingCount = filteredLines.filter((row) => !isPipelineLineAssigned(row)).length;
  const assignedCount = filteredLines.length - awaitingCount;

  return (
    <div className="space-y-4">
      <ContainerSlotsInventorySection barrels={barrels} showLookupFilters />

      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Staff assign products to your paid containers. This page is read-only — you can see
        fulfillment status, container alias, and when each assignment was made. Changes appear
        on{" "}
        <span className="font-medium text-foreground">Product to barrel history</span>.
      </p>

      <ProductToBarrelFiltersToolbar
        idPrefix="ptb"
        totalCount={lines.length}
        filteredCount={filteredLines.length}
        awaitingCount={awaitingCount}
        assignedCount={assignedCount}
        filters={filters}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => setFilters(DEFAULT_PRODUCT_TO_BARREL_FILTERS)}
        fulfillmentOptions={fulfillmentOptions}
        containerOptions={containerOptions}
        searchPlaceholder="Product, container, order, status…"
      />

      <BarrelPipelineProductSections
        lines={filteredLines}
        isAssigned={(row) => isPipelineLineAssigned(row as ProductToBarrelLineRow)}
        orderIdHint
        emptyMessage={
          lines.length === 0 ?
            "Nothing is in the barrel packing queue right now. Outside purchases paid at checkout and warehouse receipts in good condition appear here when staff are ready to assign containers."
          : "No products match your search or filters. Clear filters or try different keywords."
        }
      />
    </div>
  );
}
