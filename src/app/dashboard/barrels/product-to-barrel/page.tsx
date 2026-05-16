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
          Products that arrived in good condition and are waiting to be packed appear here. After
          you pay for shipping containers at checkout, choose which open barrel slot each product
          should go into. Staff can move items later if something does not fit or a barrel is
          full.
        </p>
      </div>
      <DashboardProductToBarrelClient lines={lines} barrels={barrels} />
    </div>
  );
}
