import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { BarrelAssignmentHistoryGroupedTable } from "@/components/barrels/barrel-assignment-history-grouped-table";
import { listBarrelAssignmentHistoryForOwner } from "@/data/barrel-package-assignment";

export const dynamic = "force-dynamic";

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
          stored here. Products are grouped — double-click a row to see every action for that
          item.
        </p>
      </div>

      <BarrelAssignmentHistoryGroupedTable rows={rows} />
    </div>
  );
}
