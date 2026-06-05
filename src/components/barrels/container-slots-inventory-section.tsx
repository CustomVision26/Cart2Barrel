"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ImageIcon, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  ProgressSnapshotView,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
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
  ownerProfiles?: Record<
    string,
    { fullName: string | null; email: string | null }
  >;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
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
  compact = false,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
  compact?: boolean;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={cn(
        compact ? "px-2 py-1.5 text-[11px] font-medium" : "px-3 py-2 font-medium",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-0.5 text-left hover:text-foreground"
      >
        {label}
        <span className="text-[9px] text-muted-foreground" aria-hidden>
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

const capacitySelectClassName = cn(
  "h-8 w-full min-w-[5.5rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
);

const capacitySelectCompactClassName = cn(
  "h-7 w-full min-w-[4.25rem] rounded-md border border-input bg-background px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
);

function LoadProgressBar({
  percent,
  compact = false,
}: {
  percent: number;
  compact?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        compact ? "h-1.5" : "h-2",
      )}
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
  compact = false,
}: {
  barrelId: string;
  percent: number;
  status: UserBarrelOptionRow["status"];
  editable: boolean;
  disabled: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const clamped = Math.min(100, Math.max(0, percent));

  if (!editable || !canAdminEditBarrelCapacity(status)) {
    return (
      <div
        className={cn(
          compact ?
            "flex min-w-[5.5rem] max-w-[7rem] items-center gap-1.5"
          : "flex min-w-[7rem] flex-col gap-1",
        )}
      >
        <span
          className={cn(
            "shrink-0 tabular-nums text-foreground",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {clamped}%
        </span>
        <LoadProgressBar percent={clamped} compact={compact} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact ? "flex min-w-[5.5rem] max-w-[7rem] flex-col gap-1" : "flex min-w-[8rem] flex-col gap-1.5",
      )}
    >
      <select
        className={compact ? capacitySelectCompactClassName : capacitySelectClassName}
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
      <LoadProgressBar percent={clamped} compact={compact} />
    </div>
  );
}

function ContainerProgressPhoto({
  barrelId,
  imageUrl,
  snapshots,
  editable,
  label,
  compact = false,
}: {
  barrelId: string;
  imageUrl: string | null;
  snapshots: ProgressSnapshotView[];
  editable: boolean;
  label: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    const fd = new FormData();
    fd.set("barrelId", barrelId);
    fd.set("file", file);
    startTransition(async () => {
      try {
        const { adminUploadBarrelProgressImageAction } = await import(
          "@/actions/admin-upload-barrel-progress-image"
        );
        const res = await adminUploadBarrelProgressImageAction(fd);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success("Progress photo updated.");
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Refresh and try again.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const { adminRemoveBarrelProgressImageAction } = await import(
          "@/actions/admin-upload-barrel-progress-image"
        );
        const res = await adminRemoveBarrelProgressImageAction({ barrelId });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success("Progress photo removed.");
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Refresh and try again.");
      }
    });
  }

  if (!editable && !imageUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {imageUrl ?
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "shrink-0 overflow-hidden rounded border border-border bg-muted",
              compact ? "size-8" : "size-10",
            )}
            aria-label="View container progress photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob public URL */}
            <img
              src={imageUrl}
              alt={`Progress photo for ${label}`}
              className="size-full object-cover"
              loading="lazy"
            />
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Container progress photos</DialogTitle>
                <DialogDescription>
                  {label} — visual record with the load percentage at each step.
                </DialogDescription>
              </DialogHeader>
              {snapshots.length > 0 ?
                <div className="max-h-[65vh] overflow-y-auto rounded-md border border-border/60">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Photo</th>
                        <th className="px-3 py-2 font-medium">Load</th>
                        <th className="px-3 py-2 font-medium">Recorded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {snapshots.map((snap) => (
                        <tr key={snap.id} className="align-middle">
                          <td className="px-3 py-2">
                            <a
                              href={snap.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block size-16 overflow-hidden rounded border border-border bg-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob public URL */}
                              <img
                                src={snap.imageUrl}
                                alt={`Progress photo for ${label}`}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          </td>
                          <td className="px-3 py-2 tabular-nums font-medium text-foreground">
                            {snap.capacityPercentage}%
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {new Date(snap.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              : <p className="text-sm text-muted-foreground">
                  No progress photos recorded yet.
                </p>
              }
            </DialogContent>
          </Dialog>
        </>
      : null}

      {editable ?
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={pending}
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="size-3.5" aria-hidden />
            {pending ? "Saving…" : "Add photo"}
          </Button>
          {imageUrl ?
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-1.5 text-muted-foreground"
              disabled={pending}
              onClick={remove}
              aria-label="Remove progress photo"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          : null}
        </>
      : null}
    </div>
  );
}


export function ContainerSlotsInventorySection({
  barrels,
  showCustomerColumn = false,
  embedded = false,
  showMarkFull = false,
  showLookupFilters = false,
  ownerProfiles,
  staffProfilesByClerkUserId = {},
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
  const compact = embedded;

  const cellClass = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";

  const countNumber =
    showLookupFilters &&
    (lookupSearch.trim() || kindFilter !== "all") &&
    counts.total !== barrels.length ?
      `${counts.total} of ${barrels.length}`
    : String(counts.total);

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-muted",
        embedded && "bg-muted",
        tableOpen ?
          compact ? "space-y-2 px-3 py-2"
          : "space-y-3 px-4 py-3"
        : compact ? "px-3 py-2" : "px-4 py-2.5",
      )}
    >
      <button
        type="button"
        onClick={() => setTableOpen((o) => !o)}
        aria-expanded={tableOpen}
        aria-label={`${tableOpen ? "Hide" : "Show"} container inventory`}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left text-muted-foreground",
          compact ? "text-xs" : "text-sm",
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className={cn("min-w-[10rem] flex-1", compact ? "space-y-1" : "space-y-1.5")}>
            <Label
              htmlFor="container-inventory-search"
              className={compact ? "text-xs" : undefined}
            >
              Search containers
            </Label>
            <div className="relative">
              <Search
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
                  compact ? "left-2 size-3.5" : "left-2.5 size-4",
                )}
              />
              <Input
                id="container-inventory-search"
                type="search"
                placeholder="Alias, slot, type, status…"
                value={lookupSearch}
                onChange={(e) => setLookupSearch(e.target.value)}
                className={cn(compact ? "h-8 pl-7 text-xs" : "pl-8")}
                autoComplete="off"
              />
            </div>
          </div>
          <div className={compact ? "space-y-1" : "space-y-1.5"}>
            <Label
              htmlFor="container-inventory-kind"
              className={compact ? "text-xs" : undefined}
            >
              Container type
            </Label>
            <select
              id="container-inventory-kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ContainerKindFilter)}
              className={cn(
                "min-w-[8rem] rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                compact ?
                  "h-8 px-2 py-0.5 text-xs"
                : "h-8 px-2.5 py-1 text-sm",
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
          <table
            className={cn(
              "w-full text-left",
              compact ? "min-w-[36rem] text-xs" : "min-w-[40rem] text-sm",
            )}
          >
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                {showCustomerColumn ?
                  <SortableHeader
                    label="Customer"
                    sortKey="customer"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={onSort}
                    compact={compact}
                    className={compact ? "max-w-[5.5rem]" : undefined}
                  />
                : null}
                <SortableHeader
                  label="Alias"
                  sortKey="alias"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                />
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                  className="whitespace-nowrap"
                />
                <SortableHeader
                  label="Container"
                  sortKey="container"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                  className={compact ? "min-w-[9rem] max-w-[11rem]" : undefined}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                  className="whitespace-nowrap"
                />
                <SortableHeader
                  label="Items"
                  sortKey="items"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                  className="text-right"
                />
                <SortableHeader
                  label={showMarkFull ? "Progress" : "Load"}
                  sortKey="load"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  compact={compact}
                  className={compact ? "w-[5.5rem]" : undefined}
                />
                <th
                  className={cn(
                    compact ? "px-2 py-1.5 text-[11px] font-medium" : "px-3 py-2 font-medium",
                    "min-w-[9rem]",
                  )}
                >
                  Updated by
                </th>
                {showMarkFull ?
                  <th
                    className={cn(
                      compact ? "px-2 py-1.5 text-[11px] font-medium" : "px-3 py-2 font-medium",
                    )}
                  >
                    Actions
                  </th>
                : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRows.map((row) => {
                const isMarking =
                  markPending && markingBarrelId === row.barrelId;
                return (
                  <tr key={row.barrelId} className="hover:bg-muted">
                    {showCustomerColumn ?
                      <td className={cellClass}>
                        {row.ownerClerkUserId ? (
                          <AdminCustomerRecordLabel
                            clerkUserId={row.ownerClerkUserId}
                            fullName={
                              ownerProfiles?.[row.ownerClerkUserId]?.fullName
                            }
                            email={ownerProfiles?.[row.ownerClerkUserId]?.email}
                            primaryClassName="text-xs font-medium"
                            secondaryClassName="text-[10px]"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    : null}
                    <td className={cn(cellClass, "whitespace-nowrap font-medium text-foreground")}>
                      {row.alias}
                    </td>
                    <td className={cn(cellClass, "whitespace-nowrap text-muted-foreground")}>
                      {containerOfferingKindLabel(row.kind)}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "max-w-[11rem] truncate text-muted-foreground",
                      )}
                      title={row.slotLabel}
                    >
                      {row.slotLabel}
                    </td>
                    <td className={cn(cellClass, "whitespace-nowrap text-muted-foreground")}>
                      {barrelStatusLabel(row.status)}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "text-right tabular-nums text-muted-foreground",
                      )}
                    >
                      {row.itemCount}
                    </td>
                    <td className={cellClass}>
                      <div className="space-y-1.5">
                        <LoadProgressCell
                          barrelId={row.barrelId}
                          percent={row.capacityPercentage}
                          status={row.status}
                          editable={showMarkFull}
                          disabled={markPending}
                          compact={compact}
                        />
                        <ContainerProgressPhoto
                          barrelId={row.barrelId}
                          imageUrl={row.progressImageUrl ?? null}
                          snapshots={row.progressSnapshots ?? []}
                          editable={showMarkFull}
                          label={`${row.alias} · ${row.slotLabel}`}
                          compact={compact}
                        />
                      </div>
                    </td>
                    <td className={cn(cellClass, "min-w-[9rem] max-w-[11rem] align-top")}>
                      <AdminUpdatedByCell
                        clerkUserId={row.lastUpdatedByClerkUserId}
                        profilesByClerkUserId={staffProfilesByClerkUserId}
                        primaryClassName={compact ? "text-[11px] font-medium" : "text-xs font-medium"}
                        secondaryClassName="text-[10px] text-muted-foreground"
                      />
                    </td>
                    {showMarkFull ?
                      <td className={cellClass}>
                        {row.status === "filling" && row.capacityPercentage < 100 ?
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className={compact ? "h-7 px-2 text-xs" : undefined}
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
                            className={compact ? "h-7 px-2 text-xs" : undefined}
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
                            className={compact ? "h-7 px-2 text-xs" : undefined}
                            disabled={markPending}
                            onClick={() => unmarkFull(row.barrelId, row.alias)}
                          >
                            {isMarking ? "Saving…" : "Remove mark full"}
                          </Button>
                        : (
                          <span className="text-muted-foreground">—</span>
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
