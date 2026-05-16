"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  adminReassignPackageBarrelAction,
  adminRemovePackageFromBarrelAction,
} from "@/actions/barrel-package-assignment";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AdminBarrelAssignmentRow,
  UserBarrelOptionRow,
} from "@/data/barrel-package-assignment";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 max-w-md rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

export type AdminBarrelAssignmentsClientProps = {
  rows: AdminBarrelAssignmentRow[];
  barrelsByOwner: Record<string, UserBarrelOptionRow[]>;
};

export function AdminBarrelAssignmentsClient({
  rows,
  barrelsByOwner,
}: AdminBarrelAssignmentsClientProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ownersMissingBarrels = useMemo(() => {
    const missing: string[] = [];
    for (const r of rows) {
      const opts = barrelsByOwner[r.ownerClerkUserId] ?? [];
      if (opts.length === 0) missing.push(r.ownerClerkUserId);
    }
    return [...new Set(missing)];
  }, [rows, barrelsByOwner]);

  return (
    <div className="space-y-4">
      {msg ?
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {msg}
        </p>
      : null}
      {err ?
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </p>
      : null}

      {ownersMissingBarrels.length > 0 ?
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Some customers have assigned packages but no provisioned container slots in the
          database (likely paid before this feature shipped). Ask them to open{" "}
          <span className="font-medium">/dashboard/barrels/product-to-barrel</span> once after
          deploy, or run a backfill. Affected user ids:{" "}
          {ownersMissingBarrels.map((id) => id.slice(0, 12)).join(", ")}…
        </p>
      : null}

      {rows.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No packages are linked to barrels yet. When shoppers assign from their dashboard, or
          you assign from here, rows will appear.
        </p>
      : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={`${row.packageId}-${row.barrelId}`}>
              <AdminAssignmentRowCard
                row={row}
                barrels={barrelsByOwner[row.ownerClerkUserId] ?? []}
                pending={pending}
                onDone={(m, ok) => {
                  if (ok) {
                    setErr(null);
                    setMsg(m);
                    router.refresh();
                  } else {
                    setMsg(null);
                    setErr(m);
                  }
                }}
                startTransition={startTransition}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminAssignmentRowCard({
  row,
  barrels,
  pending,
  onDone,
  startTransition,
}: {
  row: AdminBarrelAssignmentRow;
  barrels: UserBarrelOptionRow[];
  pending: boolean;
  onDone: (message: string, ok: boolean) => void;
  startTransition: (cb: () => void) => void;
}) {
  const [toBarrelId, setToBarrelId] = useState(row.barrelId);
  const [adminNote, setAdminNote] = useState("");

  const openTargets = barrels.filter((b) => b.status === "filling");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{row.productName}</CardTitle>
        <CardDescription className="space-y-1 font-mono text-xs">
          <span className="block">
            Customer{" "}
            <span className="text-foreground">{row.ownerClerkUserId.slice(0, 14)}…</span>
          </span>
          <span className="block">
            Package {row.packageId.slice(0, 8)}… · Current barrel:{" "}
            <span className="text-foreground">{row.barrelLabel}</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Move to barrel</span>
            <select
              className={selectClassName}
              value={toBarrelId}
              onChange={(e) => setToBarrelId(e.target.value)}
              disabled={openTargets.length === 0}
            >
              {openTargets.map((b) => (
                <option key={b.barrelId} value={b.barrelId}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Staff note (optional)</span>
            <Input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. does not fit, barrel full"
              disabled={pending}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || openTargets.length === 0 || toBarrelId === row.barrelId}
            onClick={() => {
              startTransition(async () => {
                const res = await adminReassignPackageBarrelAction({
                  packageId: row.packageId,
                  toBarrelId,
                  adminNote: adminNote.trim() || undefined,
                });
                onDone(res.message, res.ok);
              });
            }}
          >
            Reassign
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await adminRemovePackageFromBarrelAction({
                  packageId: row.packageId,
                  adminNote: adminNote.trim() || undefined,
                });
                onDone(res.message, res.ok);
              });
            }}
          >
            Remove from barrel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
