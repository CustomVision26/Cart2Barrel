import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DashboardProductToBarrelClient } from "@/components/dashboard/dashboard-product-to-barrel-client";
import { DashboardProductToBarrelHeader } from "@/components/dashboard/dashboard-product-to-barrel-header";
import {
  listProductToBarrelLinesForUser,
  listUserBarrelOptionsForAssignment,
} from "@/data/barrel-package-assignment";
import { loadBarrelPipelineProductDetailsForUser } from "@/data/barrel-pipeline-product-detail";

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

  const detailsMap = await loadBarrelPipelineProductDetailsForUser(
    userId,
    lines.map((line) => ({
      orderItemId: line.orderItemId,
      orderId: line.orderId,
      fulfillmentLabel: line.fulfillmentLabel,
      assignedContainerAlias: line.assignedContainerAlias,
      assignedAt: line.assignedAt,
    })),
  );
  const detailsByOrderItemId = Object.fromEntries(detailsMap);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <DashboardProductToBarrelHeader />
      </div>
      <DashboardProductToBarrelClient
        lines={lines}
        barrels={barrels}
        detailsByOrderItemId={detailsByOrderItemId}
      />
    </div>
  );
}
