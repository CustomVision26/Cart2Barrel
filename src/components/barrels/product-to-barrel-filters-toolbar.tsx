"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PRODUCT_TO_BARREL_FILTERS,
  type PipelineFilterableRow,
  type ProductToBarrelFilterState,
} from "@/lib/product-to-barrel-filters";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-8 min-w-[9rem] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

type ProductToBarrelFiltersToolbarProps = {
  idPrefix: string;
  totalCount: number;
  filteredCount: number;
  awaitingCount: number;
  assignedCount: number;
  filters: ProductToBarrelFilterState;
  onFiltersChange: (patch: Partial<ProductToBarrelFilterState>) => void;
  onClear: () => void;
  fulfillmentOptions: { value: string; label: string }[];
  containerOptions: { value: string; label: string }[];
  searchLabel?: string;
  searchPlaceholder?: string;
};

export function ProductToBarrelFiltersToolbar({
  idPrefix,
  totalCount,
  filteredCount,
  awaitingCount,
  assignedCount,
  filters,
  onFiltersChange,
  onClear,
  fulfillmentOptions,
  containerOptions,
  searchLabel = "Search products",
  searchPlaceholder = "Product, container, order, customer, status…",
}: ProductToBarrelFiltersToolbarProps) {
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.assignment !== "all" ||
    filters.container !== "all" ||
    filters.fulfillment !== "all" ||
    filters.sortField !== DEFAULT_PRODUCT_TO_BARREL_FILTERS.sortField ||
    filters.sortDir !== DEFAULT_PRODUCT_TO_BARREL_FILTERS.sortDir;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor={`${idPrefix}-search`}>{searchLabel}</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={`${idPrefix}-search`}
              type="search"
              placeholder={searchPlaceholder}
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              className="pl-8"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-assignment`}>Assignment</Label>
            <select
              id={`${idPrefix}-assignment`}
              value={filters.assignment}
              onChange={(e) =>
                onFiltersChange({
                  assignment: e.target.value as ProductToBarrelFilterState["assignment"],
                })
              }
              className={selectClassName}
            >
              <option value="all">All</option>
              <option value="awaiting">Awaiting</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-container`}>Container</Label>
            <select
              id={`${idPrefix}-container`}
              value={filters.container}
              onChange={(e) => onFiltersChange({ container: e.target.value })}
              className={cn(selectClassName, "min-w-[11rem] max-w-[16rem]")}
            >
              <option value="all">All containers</option>
              <option value="unassigned">Unassigned only</option>
              {containerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {fulfillmentOptions.length > 1 ?
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-fulfillment`}>Status</Label>
              <select
                id={`${idPrefix}-fulfillment`}
                value={filters.fulfillment}
                onChange={(e) => onFiltersChange({ fulfillment: e.target.value })}
                className={cn(selectClassName, "min-w-[10rem] max-w-[14rem]")}
              >
                <option value="all">All statuses</option>
                {fulfillmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          : null}

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-sort-field`}>Sort</Label>
            <div className="flex items-center gap-1">
              <select
                id={`${idPrefix}-sort-field`}
                value={filters.sortField}
                onChange={(e) =>
                  onFiltersChange({
                    sortField: e.target.value as ProductToBarrelFilterState["sortField"],
                  })
                }
                className={cn(selectClassName, "min-w-[9.5rem]")}
              >
                <option value="assigned">Assigned date</option>
                <option value="product">Product name</option>
                <option value="container">Container</option>
                <option value="fulfillment">Fulfillment status</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label={
                  filters.sortDir === "asc" ?
                    "Sort ascending — click for descending"
                  : "Sort descending — click for ascending"
                }
                title={filters.sortDir === "asc" ? "Ascending" : "Descending"}
                onClick={() =>
                  onFiltersChange({
                    sortDir: filters.sortDir === "asc" ? "desc" : "asc",
                  })
                }
              >
                {filters.sortDir === "asc" ?
                  <ArrowUp className="size-4" aria-hidden />
                : <ArrowDown className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>

          {hasActiveFilters ?
            <button
              type="button"
              className="h-8 px-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={onClear}
            >
              Clear filters
            </button>
          : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
          {filteredCount} shown
          {filteredCount !== totalCount ? ` of ${totalCount}` : ""}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
          {awaitingCount} awaiting
        </span>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
          {assignedCount} assigned
        </span>
      </div>
    </div>
  );
}

export type { PipelineFilterableRow, ProductToBarrelFilterState };
