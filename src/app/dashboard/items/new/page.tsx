import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

export default async function DashboardNewItemPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  redirect(DASHBOARD_ADD_ITEM_ROUTES.productsActive);
}
