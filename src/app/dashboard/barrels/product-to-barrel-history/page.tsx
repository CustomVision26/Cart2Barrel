import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { BarrelAssignmentHistoryProduct } from "@/components/barrels/barrel-assignment-history-product";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { listBarrelAssignmentHistoryForOwner } from "@/data/barrel-package-assignment";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function actionLabel(
  action: "assigned" | "reassigned" | "removed",
): string {
  switch (action) {
    case "assigned":
      return "Assigned";
    case "reassigned":
      return "Reassigned";
    case "removed":
      return "Removed";
    default: {
      const _e: never = action;
      return _e;
    }
  }
}

export default async function DashboardProductToBarrelHistoryPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const rows = await listBarrelAssignmentHistoryForOwner(userId, 250);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Product to barrel history
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every time you or staff move a received product into or out of a barrel slot, a row is
          stored here with the time, product, and barrel label snapshot.
        </p>
      </div>

      {rows.length === 0 ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No assignment history yet.
        </p>
      : (
        <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Barrel / movement</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatWhen(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">{actionLabel(r.action)}</td>
                  <td className="px-3 py-2">
                    <BarrelAssignmentHistoryProduct
                      productName={r.productNameSnapshot}
                      productImageUrl={r.productImageUrl}
                      quantity={r.quantity}
                    />
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    {r.barrelLabelSnapshot?.trim() || "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    {r.adminNote?.trim() || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FloatingHorizontalScroll>
      )}
    </div>
  );
}
