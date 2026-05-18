"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminReassignPackageBarrelAction,
  adminRemovePackageFromBarrelAction,
} from "@/actions/barrel-package-assignment";
import { ContainerSlotsInventorySection } from "@/components/barrels/container-slots-inventory-section";
import { Button } from "@/components/ui/button";
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

export function AdminBarrelAssignmentsClient({
  rows,
  barrelsByOwner,
}: AdminBarrelAssignmentsClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assignControlsOpen, setAssignControlsOpen] = useState(true);

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
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Customer</h2>
              <p className="font-mono text-xs text-muted-foreground">{ownerId}</p>
            </div>

            <ContainerSlotsInventorySection
              barrels={barrelsByOwner[ownerId] ?? []}
              embedded
              showMarkFull
            />

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-end border-b border-border bg-muted/30 px-3 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={assignControlsOpen}
                  onClick={() => setAssignControlsOpen((open) => !open)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      assignControlsOpen ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden
                  />
                  {assignControlsOpen ? "Hide" : "Show"} move to container
                </Button>
              </div>
              <div className="overflow-x-auto">
              <table
                className={cn(
                  "w-full text-left text-sm",
                  assignControlsOpen ? "min-w-[52rem]" : "min-w-[36rem]",
                )}
              >
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Fulfillment</th>
                    <th className="px-3 py-2 font-medium">Container</th>
                    <th className="px-3 py-2 font-medium">Assigned</th>
                    {assignControlsOpen ?
                      <th className="px-3 py-2 font-medium">Move to container</th>
                    : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ownerLines.map((row) => (
                    <AdminPipelineRowActions
                      key={row.packageId}
                      row={row}
                      barrels={barrelsByOwner[ownerId] ?? []}
                      pending={pending}
                      showAssignControls={assignControlsOpen}
                      onAction={runAction}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function AdminPipelineRowActions({
  row,
  barrels,
  pending,
  showAssignControls,
  onAction,
}: {
  row: AdminBarrelPipelineRow;
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  showAssignControls: boolean;
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
    if (!toBarrelId || !assignableBarrels.some((b) => b.barrelId === toBarrelId)) {
      setToBarrelId(defaultBarrelId);
    }
  }, [assignableBarrels, defaultBarrelId, toBarrelId]);

  const isAssigned = Boolean(row.assignedBarrelId);

  return (
    <tr className="align-top hover:bg-muted/20">
      <td className="px-3 py-2.5">
        <span className="font-medium text-foreground">{row.productName}</span>
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
          Pkg {row.packageId.slice(0, 8)}…
        </span>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{row.fulfillmentLabel}</td>
      <td className="px-3 py-2.5">
        {row.assignedContainerAlias ?
          <span className="font-medium text-foreground">{row.assignedContainerAlias}</span>
        : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {formatAssignedAt(row.assignedAt)}
      </td>
      {showAssignControls ?
        <td className="px-3 py-2.5">
          <div className="flex min-w-[14rem] flex-col gap-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">
                {isAssigned ? "Move to container" : "Assign to container"}
              </span>
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
          <Input
            className="h-8 text-xs"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Staff note (optional)"
            disabled={pending}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
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
                  () => setAdminNote(""),
                );
              }}
            >
              {isAssigned ? "Reassign" : "Assign"}
            </Button>
            {isAssigned ?
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  onAction(
                    () =>
                      adminRemovePackageFromBarrelAction({
                        packageId: row.packageId,
                        adminNote: adminNote.trim() || undefined,
                      }),
                    () => setAdminNote(""),
                  );
                }}
              >
                Remove
              </Button>
            : null}
          </div>
        </div>
        </td>
      : null}
    </tr>
  );
}
