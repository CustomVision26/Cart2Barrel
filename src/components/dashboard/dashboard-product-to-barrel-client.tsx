"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { userAssignPackageToBarrelAction } from "@/actions/barrel-package-assignment";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/data/barrel-package-assignment";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 max-w-xs rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

export type DashboardProductToBarrelClientProps = {
  lines: ProductToBarrelLineRow[];
  barrels: UserBarrelOptionRow[];
};

export function DashboardProductToBarrelClient({
  lines,
  barrels,
}: DashboardProductToBarrelClientProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState<Record<string, string>>({});

  const openBarrels = barrels.filter((b) => b.status === "filling");

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

      {openBarrels.length === 0 ?
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No paid container slots yet</CardTitle>
            <CardDescription>
              After you pay for at least one shipping container at checkout, your physical barrel
              slots appear here so you can route received products into them.
            </CardDescription>
          </CardHeader>
        </Card>
      : null}

      {lines.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing is awaiting a barrel right now. When staff confirm warehouse receipt in good
          condition, the line shows up here with status{" "}
          <span className="font-medium text-foreground">
            Delivery received: good - awaiting barrel
          </span>
          .
        </p>
      : (
        <ul className="space-y-4">
          {lines.map((line) => {
            const selectedBarrel =
              selection[line.packageId] ??
              (line.assignedBarrelId ? line.assignedBarrelId : openBarrels[0]?.barrelId ?? "");
            return (
              <li key={line.packageId}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">
                      {line.productName}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      <span className="block">
                        Fulfillment:{" "}
                        <span className="font-medium text-foreground">
                          {line.fulfillmentLabel}
                        </span>
                      </span>
                      <span className="block text-xs font-mono text-muted-foreground">
                        Order {line.orderId.slice(0, 8)}… · Package {line.packageId.slice(0, 8)}…
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {line.assignedBarrelLabel ?
                          <>
                            Assigned to{" "}
                            <span className="font-medium text-foreground">
                              {line.assignedBarrelLabel}
                            </span>
                            . Staff can move it if the item does not fit or the barrel is full.
                          </>
                        : <>
                            Not assigned yet. Choose one of your open container slots and save.
                          </>
                        }
                      </p>
                    </div>
                    {!line.assignedBarrelId && openBarrels.length > 0 ?
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setMsg(null);
                          setErr(null);
                          const barrelId = selectedBarrel;
                          if (!barrelId) {
                            setErr("Select a barrel slot.");
                            return;
                          }
                          startTransition(async () => {
                            const res = await userAssignPackageToBarrelAction({
                              packageId: line.packageId,
                              barrelId,
                            });
                            if (!res.ok) {
                              setErr(res.message);
                              return;
                            }
                            setMsg(res.message);
                            router.refresh();
                          });
                        }}
                      >
                        <label className="grid gap-1 text-sm">
                          <span className="text-muted-foreground">Barrel slot</span>
                          <select
                            className={selectClassName}
                            value={selectedBarrel}
                            onChange={(e) =>
                              setSelection((m) => ({
                                ...m,
                                [line.packageId]: e.target.value,
                              }))
                            }
                          >
                            {openBarrels.map((b) => (
                              <option key={b.barrelId} value={b.barrelId}>
                                {b.label}
                                {b.itemCount > 0 ? ` (${b.itemCount} items)` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit" disabled={pending}>
                          Assign to barrel
                        </Button>
                      </form>
                    : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
