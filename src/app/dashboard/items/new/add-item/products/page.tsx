import { redirect } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

type PageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

export default async function DashboardAddItemProductsIndexPage({
  searchParams,
}: PageProps) {
  const sp = (await searchParams) ?? {};
  const tabRaw = sp.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  if (tab === "history") {
    redirect(DASHBOARD_ADD_ITEM_ROUTES.productsHistory);
  }
  redirect(DASHBOARD_ADD_ITEM_ROUTES.productsActive);
}
