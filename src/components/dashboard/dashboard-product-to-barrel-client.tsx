"use client";

import { ContainerSlotsInventorySection } from "@/components/barrels/container-slots-inventory-section";
import type {
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
export type DashboardProductToBarrelClientProps = {
  lines: ProductToBarrelLineRow[];
  barrels: UserBarrelOptionRow[];
};

function formatAssignedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DashboardProductToBarrelClient({
  lines,
  barrels,
}: DashboardProductToBarrelClientProps) {
  return (
    <div className="space-y-4">
      <ContainerSlotsInventorySection barrels={barrels} />

      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Staff assign products to your paid containers. This page is read-only — you can see
        fulfillment status, container alias, and when each assignment was made. Changes appear
        on{" "}
        <span className="font-medium text-foreground">Product to barrel history</span>.
      </p>

      {lines.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing is in the barrel packing queue right now. Outside purchases paid at checkout
          and warehouse receipts in good condition appear here when staff are ready to assign
          containers.
        </p>
      : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Incoming product</th>
                <th className="px-3 py-2 font-medium">Fulfillment status</th>
                <th className="px-3 py-2 font-medium">Container</th>
                <th className="px-3 py-2 font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => (
                <tr key={line.packageId} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">{line.productName}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      Order {line.orderId.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{line.fulfillmentLabel}</td>
                  <td className="px-3 py-2.5">
                    {line.assignedContainerAlias ?
                      <span className="font-medium text-foreground">
                        {line.assignedContainerAlias}
                      </span>
                    : <span className="text-muted-foreground">Not assigned yet</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatAssignedAt(line.assignedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
