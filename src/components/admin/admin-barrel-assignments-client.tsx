"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminReassignPackageBarrelAction,
  adminRemovePackageFromBarrelAction,
} from "@/actions/barrel-package-assignment";
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
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

export type AdminBarrelAssignmentsClientProps = {
  rows: AdminBarrelPipelineRow[];
  barrelsByOwner: Record<string, UserBarrelOptionRow[]>;
};

function formatAssignedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAssignedAtShort(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function AdminBarrelAssignmentsClient({
  rows,
  barrelsByOwner,
}: AdminBarrelAssignmentsClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, AdminBarrelPipelineRow[]>();
    for (const row of rows) {
      const list = map.get(row.ownerClerkUserId) ?? [];
      list.push(row);
      map.set(row.ownerClerkUserId, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

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
          user ids: {ownersMissingBarrels.map((id) => id.slice(0, 12)).join(", ")}…
        </p>
      : null}

      {grouped.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No products are in the barrel packing queue. Outside purchases with paid service fees
          and warehouse receipts in good condition appear here.
        </p>
      : (
        grouped.map(([ownerId, ownerLines]) => (
          <section key={ownerId} className="space-y-4">
            <OwnerAssignmentSection
              ownerId={ownerId}
              ownerLines={ownerLines}
              barrels={barrelsByOwner[ownerId] ?? []}
              pending={pending}
              onAction={runAction}
            />
          </section>
        ))
      )}
    </div>
  );
}

const productGridClassName =
  "grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

function OwnerAssignmentSection({
  ownerId,
  ownerLines,
  barrels,
  pending,
  onAction,
}: {
  ownerId: string;
  ownerLines: AdminBarrelPipelineRow[];
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onAction: (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => void;
}) {
  const unassigned = ownerLines.filter((row) => !row.assignedBarrelId);
  const assigned = ownerLines.filter((row) => Boolean(row.assignedBarrelId));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-foreground">Customer</h2>
          <p className="font-mono text-[11px] text-muted-foreground">{ownerId}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {unassigned.length} awaiting
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {assigned.length} assigned
          </span>
        </div>
      </div>

      <ContainerSlotsInventorySection barrels={barrels} embedded showMarkFull />

      {unassigned.length > 0 ?
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Awaiting assignment ({unassigned.length})
          </h3>
          <div className={productGridClassName}>
            {unassigned.map((row) => (
              <AdminPipelineProductCard
                key={row.packageId}
                row={row}
                barrels={barrels}
                pending={pending}
                onAction={onAction}
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
          <div className={productGridClassName}>
            {assigned.map((row) => (
              <AdminPipelineProductCard
                key={row.packageId}
                row={row}
                barrels={barrels}
                pending={pending}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      : null}
    </>
  );
}

function AdminPipelineProductCard({
  row,
  barrels,
  pending,
  onAction,
}: {
  row: AdminBarrelPipelineRow;
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onAction: (
    fn: () => Promise<{ ok: boolean; message: string }>,
    onSuccess?: () => void,
  ) => void;
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
