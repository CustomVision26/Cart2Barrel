"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { ProductToBarrelFiltersToolbar } from "@/components/barrels/product-to-barrel-filters-toolbar";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";

import {
  adminReassignPackageBarrelAction,
  adminRemovePackageFromBarrelAction,
} from "@/actions/barrel-package-assignment";
import {
  barrelPipelineProductGridClassName,
  formatBarrelAssignmentWhenShort,
} from "@/lib/barrel-pipeline-product-display";
import { ContainerSlotsInventorySection } from "@/components/barrels/container-slots-inventory-section";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  AdminBarrelPipelineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
import {
  barrelAssignmentDropdownSuffix,
  isBarrelOpenForAssignment,
} from "@/lib/barrel-container-assignment";
import { formatContainerAliasOptionLabel } from "@/lib/container-slot-alias";
import {
  containerFilterOptionsByBarrelId,
  DEFAULT_PRODUCT_TO_BARREL_FILTERS,
  filterAndSortPipelineLines,
  isPipelineLineAssigned,
  uniqueFulfillmentStatuses,
  type ProductToBarrelFilterState,
} from "@/lib/product-to-barrel-filters";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

export type AdminBarrelAssignmentsClientProps = {
  rows: AdminBarrelPipelineRow[];
  barrelsByOwner: Record<string, UserBarrelOptionRow[]>;
  ownerProfiles: Record<
    string,
    { fullName: string | null; email: string | null }
  >;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

function formatAssignedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAssignedAtShort(iso: string | null): string | null {
  return formatBarrelAssignmentWhenShort(iso);
}

export function AdminBarrelAssignmentsClient({
  rows,
  barrelsByOwner,
  ownerProfiles,
  staffProfilesByClerkUserId = {},
}: AdminBarrelAssignmentsClientProps) {
  const baseId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ProductToBarrelFilterState>(
    DEFAULT_PRODUCT_TO_BARREL_FILTERS,
  );
  const [openOwnerIds, setOpenOwnerIds] = useState<string[]>([]);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);

  useEffect(() => {
    setPanelChoiceMade(false);
    setOpenOwnerIds([]);
  }, [filters]);

  const allBarrels = useMemo(
    () => Object.values(barrelsByOwner).flat(),
    [barrelsByOwner],
  );

  const fulfillmentOptions = useMemo(
    () => uniqueFulfillmentStatuses(rows),
    [rows],
  );
  const containerOptions = useMemo(
    () => containerFilterOptionsByBarrelId(allBarrels),
    [allBarrels],
  );

  const filteredRows = useMemo(
    () => filterAndSortPipelineLines(rows, filters),
    [rows, filters],
  );

  const filteredAwaitingCount = filteredRows.filter(
    (row) => !isPipelineLineAssigned(row),
  ).length;
  const filteredAssignedCount = filteredRows.length - filteredAwaitingCount;

  const grouped = useMemo(() => {
    const map = new Map<string, AdminBarrelPipelineRow[]>();
    for (const row of filteredRows) {
      const list = map.get(row.ownerClerkUserId) ?? [];
      list.push(row);
      map.set(row.ownerClerkUserId, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const profileA = ownerProfiles[a];
      const profileB = ownerProfiles[b];
      return adminCustomerSortKey({
        clerkUserId: a,
        fullName: profileA?.fullName,
        email: profileA?.email,
      }).localeCompare(
        adminCustomerSortKey({
          clerkUserId: b,
          fullName: profileB?.fullName,
          email: profileB?.email,
        }),
      );
    });
  }, [filteredRows, ownerProfiles]);

  const defaultOpenOwnerIds = useMemo(
    () =>
      grouped
        .filter(([, lines]) => lines.some((row) => !isPipelineLineAssigned(row)))
        .map(([ownerId]) => ownerId),
    [grouped],
  );
  const effectiveOpenIds = panelChoiceMade ? openOwnerIds : defaultOpenOwnerIds;

  const toggleOwner = useCallback(
    (ownerId: string) => {
      setOpenOwnerIds((prev) => {
        const current = panelChoiceMade ? prev : defaultOpenOwnerIds;
        return current.includes(ownerId) ?
            current.filter((id) => id !== ownerId)
          : [...current, ownerId];
      });
      setPanelChoiceMade(true);
    },
    [panelChoiceMade, defaultOpenOwnerIds],
  );

  const ownersMissingBarrels = useMemo(() => {
    const missing: string[] = [];
    for (const [ownerId, lines] of grouped) {
      const opts = barrelsByOwner[ownerId] ?? [];
      if (lines.length > 0 && opts.length === 0) missing.push(ownerId);
    }
    return missing;
  }, [grouped, barrelsByOwner]);

  const runAction = (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message);
        onSuccess?.();
        router.refresh();
      } catch {
        toast.error(
          "Could not reach the server. Refresh the page and try again.",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {ownersMissingBarrels.length > 0 ?
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Some customers have pipeline products but no provisioned container slots. Affected
          customers:{" "}
          {ownersMissingBarrels
            .map((id) =>
              adminCustomerDisplayLabel({
                clerkUserId: id,
                fullName: ownerProfiles[id]?.fullName,
                email: ownerProfiles[id]?.email,
              }),
            )
            .join(", ")}
          .
        </p>
      : null}

      <ProductToBarrelFiltersToolbar
        idPrefix="admin-atb"
        totalCount={rows.length}
        filteredCount={filteredRows.length}
        awaitingCount={filteredAwaitingCount}
        assignedCount={filteredAssignedCount}
        filters={filters}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => setFilters(DEFAULT_PRODUCT_TO_BARREL_FILTERS)}
        fulfillmentOptions={fulfillmentOptions}
        containerOptions={containerOptions}
        searchLabel="Search products & customers"
        searchPlaceholder="Product, container, customer id, order, status…"
      />

      {rows.length === 0 ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No products are in the barrel packing queue. Outside purchases with paid service fees
          and warehouse receipts in good condition appear here.
        </p>
      : grouped.length === 0 ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No products match your search or filters. Clear filters or try different keywords.
        </p>
      : (
        grouped.map(([ownerId, ownerLines]) => (
          <section
            key={ownerId}
            className="overflow-hidden rounded-lg border border-border"
          >
            <OwnerAssignmentSection
              ownerId={ownerId}
              ownerProfile={ownerProfiles[ownerId]}
              ownerLines={ownerLines}
              barrels={barrelsByOwner[ownerId] ?? []}
              pending={pending}
              onAction={runAction}
              expanded={effectiveOpenIds.includes(ownerId)}
              onToggle={() => toggleOwner(ownerId)}
              panelIds={{
                switchId: `${baseId}-line-find-organize-${ownerId}`,
                searchId: `${baseId}-line-search-${ownerId}`,
                pageSizeId: `${baseId}-line-page-size-${ownerId}`,
              }}
              ownerProfiles={ownerProfiles}
              staffProfilesByClerkUserId={staffProfilesByClerkUserId}
            />
          </section>
        ))
      )}
    </div>
  );
}

function OwnerAssignmentSection({
  ownerId,
  ownerProfile,
  ownerProfiles,
  ownerLines,
  barrels,
  pending,
  onAction,
  expanded,
  onToggle,
  panelIds,
  staffProfilesByClerkUserId = {},
}: {
  ownerId: string;
  ownerProfile?: { fullName: string | null; email: string | null };
  ownerProfiles: Record<
    string,
    { fullName: string | null; email: string | null }
  >;
  ownerLines: AdminBarrelPipelineRow[];
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onAction: (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => void;
  expanded: boolean;
  onToggle: () => void;
  panelIds: { switchId: string; searchId: string; pageSizeId: string };
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<5 | 10 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);

  const onLineSearchChange = useCallback((value: string) => {
    setLineSearch(value);
    setLinePage(1);
  }, []);
  const onLineFindOrganizeVisibleChange = setLineFindOrganizeVisible;
  const onLinePageSizeChange = useCallback((size: 5 | 10 | 25 | 50) => {
    setLinePageSize(size);
    setLinePage(1);
  }, []);
  const onLinePageChange = setLinePage;

  const nestedFilters = useMemo(
    () => ({
      ...DEFAULT_PRODUCT_TO_BARREL_FILTERS,
      search: lineSearch,
    }),
    [lineSearch],
  );
  const ownerFiltered = useMemo(
    () => filterAndSortPipelineLines(ownerLines, nestedFilters),
    [ownerLines, nestedFilters],
  );
  const lineCount = ownerFiltered.length;
  const lineTotalPages = Math.max(1, Math.ceil(lineCount / linePageSize));
  const linePageSafe = Math.min(Math.max(1, linePage), lineTotalPages);
  const lineStart = (linePageSafe - 1) * linePageSize;
  const pageSlice = ownerFiltered.slice(lineStart, lineStart + linePageSize);
  const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
  const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

  const unassigned = pageSlice.filter((row) => !isPipelineLineAssigned(row));
  const assigned = pageSlice.filter((row) => isPipelineLineAssigned(row));
  const totalUnassigned = ownerLines.filter(
    (row) => !isPipelineLineAssigned(row),
  ).length;
  const totalAssigned = ownerLines.length - totalUnassigned;

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex w-full flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-4 py-3 text-left hover:bg-accent",
          expanded && "bg-accent",
        )}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
          )}
          <AdminCustomerRecordLabel
            clerkUserId={ownerId}
            fullName={ownerProfile?.fullName}
            email={ownerProfile?.email}
            primaryClassName="text-base"
          />
        </span>
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {totalUnassigned} awaiting
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {totalAssigned} assigned
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="space-y-4 p-4">
          <AdminNestedFindOrganizePanel
            switchId={panelIds.switchId}
            searchInputId={panelIds.searchId}
            pageSizeSelectId={panelIds.pageSizeId}
            visible={lineFindOrganizeVisible}
            onVisibleChange={onLineFindOrganizeVisibleChange}
            search={lineSearch}
            onSearchChange={onLineSearchChange}
            searchLabel="Search products"
            searchPlaceholder="Product, container, order, status…"
            pageSize={linePageSize}
            onPageSizeChange={onLinePageSizeChange}
            pageSizeLabel="Products per page"
            showFrom={lineShowFrom}
            showTo={lineShowTo}
            totalCount={lineCount}
            totalLoaded={ownerLines.length}
            itemLabel="product"
            className="mb-0"
          />
          {lineCount > linePageSize ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linePageSafe <= 1}
                onClick={() => onLinePageChange(Math.max(1, linePageSafe - 1))}
              >
                Previous products
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linePageSafe >= lineTotalPages}
                onClick={() =>
                  onLinePageChange(Math.min(lineTotalPages, linePageSafe + 1))
                }
              >
                Next products
              </Button>
            </div>
          ) : null}

          <ContainerSlotsInventorySection
            barrels={barrels}
            embedded
            showMarkFull
            showLookupFilters
            showCustomerColumn
            ownerProfiles={ownerProfiles}
            staffProfilesByClerkUserId={staffProfilesByClerkUserId}
          />

          {pageSlice.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lineSearch.trim()
                ? "No products match the current search."
                : "No products for this customer."}
            </p>
          ) : null}

          {unassigned.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Awaiting assignment ({unassigned.length}
                {lineCount !== ownerLines.length ? " on page" : ""})
              </h3>
              <div className={barrelPipelineProductGridClassName}>
                {unassigned.map((row) => (
                  <AdminPipelineProductCard
                    key={row.packageId}
                    row={row}
                    barrels={barrels}
                    pending={pending}
                    onAction={onAction}
                    staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {assigned.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Assigned to container ({assigned.length}
                {lineCount !== ownerLines.length ? " on page" : ""})
              </h3>
              <div className={barrelPipelineProductGridClassName}>
                {assigned.map((row) => (
                  <AdminPipelineProductCard
                    key={row.packageId}
                    row={row}
                    barrels={barrels}
                    pending={pending}
                    onAction={onAction}
                    staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AdminPipelineProductCard({
  row,
  barrels,
  pending,
  onAction,
  staffProfilesByClerkUserId = {},
}: {
  row: AdminBarrelPipelineRow;
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onAction: (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => void;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const isAssigned = Boolean(row.assignedBarrelId);
  const assignedShort = formatAssignedAtShort(row.assignedAt);

  return (
    <article className="group flex gap-2.5 overflow-hidden rounded-lg border border-border/80 bg-card/90 p-2 shadow-sm transition-[border-color,box-shadow,background-color] hover:border-border hover:bg-card hover:shadow-md">
      <div className="relative shrink-0 self-start">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={row.productImageUrl}
          productLabel={row.productName}
        />
        {row.quantity > 1 ?
          <span
            className="absolute -bottom-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px text-[9px] font-semibold leading-none text-primary-foreground shadow-sm"
            title={`Quantity ${row.quantity}`}
          >
            {row.quantity}
          </span>
        : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="space-y-0.5">
          <h3
            className="line-clamp-2 text-xs font-semibold leading-snug text-foreground"
            title={row.productName}
          >
            {row.productName}
          </h3>
          <p
            className="line-clamp-1 text-[10px] leading-tight text-muted-foreground"
            title={row.fulfillmentLabel}
          >
            {row.fulfillmentLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
          {isAssigned ?
            <span className="inline-flex min-w-0 items-center gap-1 text-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="truncate font-medium">{row.assignedContainerAlias}</span>
              {assignedShort ?
                <span className="shrink-0 text-muted-foreground">· {assignedShort}</span>
              : null}
            </span>
          : <span className="text-muted-foreground">Awaiting assignment</span>}
        </div>

        <div className="text-[10px]">
          <span className="text-muted-foreground">Updated by </span>
          <AdminUpdatedByCell
            clerkUserId={row.lastUpdatedByClerkUserId}
            profilesByClerkUserId={staffProfilesByClerkUserId}
            primaryClassName="inline text-[10px] font-medium"
            secondaryClassName="text-[9px] text-muted-foreground"
          />
        </div>

        <Button
          type="button"
          variant={isAssigned ? "outline" : "default"}
          size="sm"
          className="mt-0.5 h-7 w-full text-xs"
          onClick={() => setAssignOpen(true)}
        >
          {isAssigned ? "Move" : "Assign to container"}
        </Button>
      </div>

      <AdminPipelineAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        row={row}
        barrels={barrels}
        pending={pending}
        onAction={onAction}
      />
    </article>
  );
}

function AdminPipelineAssignDialog({
  open,
  onOpenChange,
  row,
  barrels,
  pending,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminBarrelPipelineRow;
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onAction: (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => void;
}) {
  const assignableBarrels = useMemo(
    () => barrels.filter(isBarrelOpenForAssignment),
    [barrels],
  );
  const closedBarrels = useMemo(
    () => barrels.filter((b) => !isBarrelOpenForAssignment(b)),
    [barrels],
  );

  const defaultBarrelId = useMemo(() => {
    if (
      row.assignedBarrelId &&
      assignableBarrels.some((b) => b.barrelId === row.assignedBarrelId)
    ) {
      return row.assignedBarrelId;
    }
    return assignableBarrels[0]?.barrelId ?? "";
  }, [assignableBarrels, row.assignedBarrelId]);

  const [toBarrelId, setToBarrelId] = useState(defaultBarrelId);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setToBarrelId(defaultBarrelId);
    setAdminNote("");
  }, [open, defaultBarrelId]);

  useEffect(() => {
    if (!toBarrelId || !assignableBarrels.some((b) => b.barrelId === toBarrelId)) {
      setToBarrelId(defaultBarrelId);
    }
  }, [assignableBarrels, defaultBarrelId, toBarrelId]);

  const isAssigned = Boolean(row.assignedBarrelId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAssigned ? "Move to container" : "Assign to container"}
          </DialogTitle>
          <DialogDescription className="line-clamp-3">{row.productName}</DialogDescription>
          <div className="font-mono text-[10px] text-muted-foreground">
            Pkg {row.packageId.slice(0, 8)}… · Assigned {formatAssignedAt(row.assignedAt)}
          </div>
        </DialogHeader>

        <div className="flex gap-3">
          <ProductRequestThumbnail
            variant="dialog"
            imageUrl={row.productImageUrl}
            productLabel={row.productName}
          />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="text-muted-foreground">{row.fulfillmentLabel}</p>
            {row.quantity > 1 ?
              <p className="text-xs text-muted-foreground">Quantity: {row.quantity}</p>
            : null}
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Container</span>
            <select
              className={selectClassName}
              value={toBarrelId}
              onChange={(e) => setToBarrelId(e.target.value)}
              disabled={pending || assignableBarrels.length === 0}
            >
              {assignableBarrels.length === 0 ?
                <option value="">No open containers available</option>
              : null}
              {assignableBarrels.map((b) => (
                <option key={b.barrelId} value={b.barrelId}>
                  {formatContainerAliasOptionLabel(b.alias, b.itemCount)}
                </option>
              ))}
              {closedBarrels.length > 0 ?
                <optgroup label="Unavailable">
                  {closedBarrels.map((b) => {
                    const suffix = barrelAssignmentDropdownSuffix(b);
                    return (
                      <option
                        key={b.barrelId}
                        value={b.barrelId}
                        disabled
                        className="text-muted-foreground"
                      >
                        {formatContainerAliasOptionLabel(b.alias, b.itemCount)}
                        {suffix ? ` — ${suffix}` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              : null}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Staff note (optional)</span>
            <Input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Reason for reassignment, fit issue, etc."
              disabled={pending}
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {isAssigned ?
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                onAction(
                  () =>
                    adminRemovePackageFromBarrelAction({
                      packageId: row.packageId,
                      adminNote: adminNote.trim() || undefined,
                    }),
                  () => onOpenChange(false),
                );
              }}
            >
              Remove
            </Button>
          : null}
          <Button
            type="button"
            disabled={
              pending ||
              assignableBarrels.length === 0 ||
              !toBarrelId ||
              (isAssigned && toBarrelId === row.assignedBarrelId)
            }
            onClick={() => {
              onAction(
                () =>
                  adminReassignPackageBarrelAction({
                    packageId: row.packageId,
                    toBarrelId,
                    adminNote: adminNote.trim() || undefined,
                  }),
                () => onOpenChange(false),
              );
            }}
          >
            {isAssigned ? "Reassign" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
