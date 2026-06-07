import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

export default function DashboardAddItemBatchQuotesIndexPage() {
  redirect(DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive);
}
