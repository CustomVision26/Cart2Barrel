import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";

export default async function DashboardItemsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  redirect(DASHBOARD_REQUESTED_ITEMS_ROUTE);
}
