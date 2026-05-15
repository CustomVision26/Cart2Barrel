import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Product history UI lives under Products → History (`?tab=history`). */
export default function DashboardAddItemProductHistoryPage() {
  redirect(DASHBOARD_ADD_ITEM_ROUTES.productHistory);
}
