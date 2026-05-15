import { redirect } from "next/navigation";

import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";

/** Legacy path: item requests use the AI-assisted flow only. */
export default function DashboardManualItemRequestRedirectPage() {
  redirect(DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE);
}
