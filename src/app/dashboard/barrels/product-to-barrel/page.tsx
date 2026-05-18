import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DashboardProductToBarrelClient } from "@/components/dashboard/dashboard-product-to-barrel-client";
import {
  listProductToBarrelLinesForUser,
  listUserBarrelOptionsForAssignment,
} from "@/data/barrel-package-assignment";

export const dynamic = "force-dynamic";

export default async function DashboardProductToBarrelPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const [lines, barrels] = await Promise.all([
    listProductToBarrelLinesForUser(userId),
    listUserBarrelOptionsForAssignment(userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Product to barrel
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track products that arrived in good condition and staff container assignments. Assignment
          and moves are handled by Cart2Barrel staff — this page shows fulfillment status, container
          alias, and when each product was assigned.
        </p>
      </div>
      <DashboardProductToBarrelClient lines={lines} barrels={barrels} />
    </div>
  );
}
