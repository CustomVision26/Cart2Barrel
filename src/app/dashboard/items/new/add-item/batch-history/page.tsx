import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Batch history UI lives under Batch Quotes → History. */
export default function DashboardAddItemBatchHistoryPage() {
  redirect(DASHBOARD_ADD_ITEM_ROUTES.batchHistory);
}
