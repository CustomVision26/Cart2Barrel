import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

/** Layout owns the shell; this segment has no UI without a tab. */
export default function DashboardAddItemIndexPage() {
  redirect(DASHBOARD_ADD_ITEM_ROUTES.productsActive);
}
