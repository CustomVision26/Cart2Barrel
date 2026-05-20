"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  BARREL_CAPACITY_PERCENT_OPTIONS,
  canAdminEditBarrelCapacity,
} from "@/lib/barrel-container-assignment";
import {
  aliasSortKey,
  barrelStatusLabel,
  countContainersByKind,
} from "@/lib/container-slot-alias";
import {
  filterContainerInventoryRows,
  type ContainerKindFilter,
} from "@/lib/product-to-barrel-filters";
import type { UserBarrelOptionRow } from "@/lib/barrel-container-types";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

type SortKey =
  | "alias"
  | "type"
  | "container"
  | "status"
  | "items"
  | "load"
  | "customer"
  | "actions";

type ContainerSlotsInventorySectionProps = {
  barrels: UserBarrelOptionRow[];
  /** When set, adds a Customer column (admin assign UI). */
  showCustomerColumn?: boolean;
  /** Per-assignment card: table open by default, compact chrome. */
  embedded?: boolean;
  /** Admin: mark container full (ready to ship, 100% load). */
  showMarkFull?: boolean;
  /** Search + type filter above the inventory table (dashboard product-to-barrel). */
  showLookupFilters?: boolean;
};

function compareRows(
  a: UserBarrelOptionRow,
  b: UserBarrelOptionRow,
  key: SortKey,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (key) {
    case "alias":
      return (
        sign *
        (aliasSortKey(a.alias, a.kind) - aliasSortKey(b.alias, b.kind))
      );
    case "type":
      return (
        sign * a.kind.localeCompare(b.kind) ||
        aliasSortKey(a.alias, a.kind) - aliasSortKey(b.alias, b.kind)
      );
    case "container":
      return sign * a.slotLabel.localeCompare(b.slotLabel);
    case "status":
      return sign * a.status.localeCompare(b.status);
    case "items":
      return sign * (a.itemCount - b.itemCount);
    case "load":
      return sign * (a.capacityPercentage - b.capacityPercentage);
    case "customer": {
      const ao = a.ownerClerkUserId ?? "";
      const bo = b.ownerClerkUserId ?? "";
      return (
        sign * ao.localeCompare(bo) ||
        aliasSortKey(a.alias, a.kind) - aliasSortKey(b.alias, b.kind)
      );
    }
    default:
      return 0;
  }
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={cn("px-3 py-2 font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-left hover:text-foreground"
      >
        {label}
        <span className="text-[10px] text-muted-foreground" aria-hidden>
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

const capacitySelectClassName = cn(
  "h-8 w-full min-w-[5.5rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
);

function LoadProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          clamped >= 100 ? "bg-amber-500"
          : clamped >= 90 ? "bg-amber-500/80"
          : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function LoadProgressCell({
  barrelId,
  percent,
  status,
  editable,
  disabled,
}: {
  barrelId: string;
  percent: number;
  status: UserBarrelOptionRow["status"];
  editable: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const clamped = Math.min(100, Math.max(0, percent));

  if (!editable || !canAdminEditBarrelCapacity(status)) {
    return (
      <div className="flex min-w-[7rem] flex-col gap-1">
        <span className="text-xs tabular-nums text-foreground">{clamped}%</span>
        <LoadProgressBar percent={clamped} />
      </div>
    );
  }

  return (
    <div className="flex min-w-[8rem] flex-col gap-1.5">
      <select
        className={capacitySelectClassName}
        value={String(clamped)}
        disabled={disabled || pending}
        aria-label="Container load progress"
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          startTransition(async () => {
            try {
              const { adminUpdateBarrelCapacityAction } = await import(
                "@/actions/admin-barrel-container-capacity"
              );
              const res = await adminUpdateBarrelCapacityAction({
                barrelId,
                capacityPercentage: next,
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success(res.message);
              router.refresh();
            } catch {
              toast.error(
                "Could not reach the server. Refresh the page and try again.",
              );
            }
          });
        }}
      >
        {BARREL_CAPACITY_PERCENT_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}%
          </option>
        ))}
      </select>
      <LoadProgressBar percent={clamped} />
    </div>
  );
}


export function ContainerSlotsInventorySection({
  barrels,
  showCustomerColumn = false,
  embedded = false,
  showMarkFull = false,
  showLookupFilters = false,
}: ContainerSlotsInventorySectionProps) {
  const router = useRouter();
  const [tableOpen, setTableOpen] = useState(embedded);
  const [sortKey, setSortKey] = useState<SortKey>("alias");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [lookupSearch, setLookupSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<ContainerKindFilter>("all");
  const [markingBarrelId, setMarkingBarrelId] = useState<string | null>(null);
  const [markPending, startMarkTransition] = useTransition();

  const filteredBarrels = useMemo(
    () =>
      showLookupFilters ?
        filterContainerInventoryRows(barrels, lookupSearch, kindFilter)
      : barrels,
    [barrels, lookupSearch, kindFilter, showLookupFilters],
  );

  const counts = useMemo(() => countContainersByKind(filteredBarrels), [filteredBarrels]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredBarrels];
    copy.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return copy;
  }, [filteredBarrels, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const runContainerAction = (
    barrelId: string,
    alias: string,
    action: (input: { barrelId: string }) => Promise<{ ok: boolean; message?: string }>,
    fallbackSuccess: string,
  ) => {
    setMarkingBarrelId(barrelId);
    startMarkTransition(async () => {
      try {
        const res = await action({ barrelId });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? fallbackSuccess.replace("{alias}", alias));
        router.refresh();
      } catch {
        toast.error(
          "Could not reach the server. Refresh the page and try again.",
        );
      } finally {
        setMarkingBarrelId(null);
      }
    });
  };

  const markFull = (barrelId: string, alias: string) => {
    void import("@/actions/admin-barrel-container-capacity").then(
      ({ adminMarkBarrelContainerFullAction }) => {
        runContainerAction(
          barrelId,
          alias,
          adminMarkBarrelContainerFullAction,
          "{alias} marked full.",
        );
      },
    );
  };

  const unmarkFull = (barrelId: string, alias: string) => {
    void import("@/actions/admin-barrel-container-capacity").then(
      ({ adminUnmarkBarrelContainerFullAction }) => {
        runContainerAction(
          barrelId,
          alias,
          adminUnmarkBarrelContainerFullAction,
          "{alias} reopened for packing.",
        );
      },
    );
  };

  if (barrels.length === 0) {
    return null;
  }

  const countParts: string[] = [];
  if (counts.barrelCount > 0) {
    countParts.push(
      `${counts.barrelCount} barrel${counts.barrelCount === 1 ? "" : "s"}`,
    );
  }
  if (counts.binCount > 0) {
    countParts.push(`${counts.binCount} bin${counts.binCount === 1 ? "" : "s"}`);
  }

  const tableVisible = tableOpen;

  const countNumber =
    showLookupFilters &&
    (lookupSearch.trim() || kindFilter !== "all") &&
    counts.total !== barrels.length ?
      `${counts.total} of ${barrels.length}`
    : String(counts.total);

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-muted/20",
        embedded && "bg-muted/10",
        tableOpen ? "space-y-3 px-4 py-3" : "px-4 py-2.5",
      )}
    >
      <button
        type="button"
        onClick={() => setTableOpen((o) => !o)}
        aria-expanded={tableOpen}
        aria-label={`${tableOpen ? "Hide" : "Show"} container inventory`}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left text-sm text-muted-foreground",
          "rounded-md outline-none transition-colors hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <span>
          <span className="font-medium text-foreground">{countNumber}</span> paid
          container{counts.total === 1 ? "" : "s"}
          {countParts.length > 0 ?
            <span> ({countParts.join(", ")})</span>
          : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            tableOpen ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      {showLookupFilters && tableVisible ?
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="container-inventory-search">Search containers</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="container-inventory-search"
                type="search"
                placeholder="Alias, slot, type, status…"
                value={lookupSearch}
                onChange={(e) => setLookupSearch(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="container-inventory-kind">Container type</Label>
            <select
              id="container-inventory-kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ContainerKindFilter)}
              className={cn(
                "h-8 min-w-[9rem] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "dark:bg-input/30",
              )}
            >
              <option value="all">All types</option>
              <option value="barrel">Barrels only</option>
              <option value="bin">Bins only</option>
            </select>
          </div>
          {(lookupSearch.trim() || kindFilter !== "all") ?
            <button
              type="button"
              className="h-8 px-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setLookupSearch("");
                setKindFilter("all");
              }}
            >
              Clear
            </button>
          : null}
        </div>
      : null}

      {tableVisible && sortedRows.length === 0 && filteredBarrels.length === 0 && barrels.length > 0 ?
        <p className="text-sm text-muted-foreground">
          No containers match your search. Clear filters to see all slots.
        </p>
      : null}

      {tableVisible && sortedRows.length > 0 ?
        <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border bg-background">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {showCustomerColumn ?
                  <SortableHeader
                    label="Customer"
                    sortKey="customer"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={onSort}
                  />
                : null}
                <SortableHeader
                  label="Alias"
                  sortKey="alias"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Container"
                  sortKey="container"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Items"
                  sortKey="items"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
                <SortableHeader
                  label={showMarkFull ? "Progress" : "Load"}
                  sortKey="load"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                />
                {showMarkFull ?
                  <th className="px-3 py-2 font-medium">Actions</th>
                : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRows.map((row) => {
                const isMarking =
                  markPending && markingBarrelId === row.barrelId;
                return (
                  <tr key={row.barrelId} className="hover:bg-muted/20">
                    {showCustomerColumn ?
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {row.ownerClerkUserId?.slice(0, 12) ?? "—"}…
                      </td>
                    : null}
                    <td className="px-3 py-2 font-medium text-foreground">{row.alias}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {containerOfferingKindLabel(row.kind)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.slotLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {barrelStatusLabel(row.status)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.itemCount}
                    </td>
                    <td className="px-3 py-2">
                      <LoadProgressCell
                        barrelId={row.barrelId}
                        percent={row.capacityPercentage}
                        status={row.status}
                        editable={showMarkFull}
                        disabled={markPending}
                      />
                    </td>
                    {showMarkFull ?
                      <td className="px-3 py-2">
                        {row.status === "filling" && row.capacityPercentage < 100 ?
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={markPending}
                            onClick={() => markFull(row.barrelId, row.alias)}
                          >
                            {isMarking ? "Saving…" : "Mark full"}
                          </Button>
                        : row.status === "filling" && row.capacityPercentage >= 100 ?
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={markPending}
                            onClick={() => markFull(row.barrelId, row.alias)}
                          >
                            {isMarking ? "Saving…" : "Mark full"}
                          </Button>
                        : row.status === "ready_to_ship" ?
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={markPending}
                            onClick={() => unmarkFull(row.barrelId, row.alias)}
                          >
                            {isMarking ? "Saving…" : "Remove mark full"}
                          </Button>
                        : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </FloatingHorizontalScroll>
      : null}
    </section>
  );
}
