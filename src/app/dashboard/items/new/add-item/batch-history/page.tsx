import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Legacy batch history URL; batch quote history UI was removed from the shopper dashboard. */
export default function DashboardAddItemBatchHistoryPage() {
  redirect(DASHBOARD_ADD_ITEM_ROUTES.batchHistory);
}
