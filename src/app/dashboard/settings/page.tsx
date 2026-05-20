import { redirect } from "next/navigation";

import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";

export default function DashboardSettingsRedirectPage() {
  redirect(DASHBOARD_SHIPPING_ROUTES.address);
}
