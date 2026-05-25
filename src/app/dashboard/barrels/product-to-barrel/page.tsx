import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DashboardProductToBarrelClient } from "@/components/dashboard/dashboard-product-to-barrel-client";
import { DashboardProductToBarrelHeader } from "@/components/dashboard/dashboard-product-to-barrel-header";
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
        <DashboardProductToBarrelHeader />
      </div>
      <DashboardProductToBarrelClient lines={lines} barrels={barrels} />
    </div>
  );
}
