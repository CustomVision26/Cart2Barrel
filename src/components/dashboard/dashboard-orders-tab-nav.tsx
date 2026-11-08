import Link from "next/link";

import { customerPillTabClass, customerPillTablistClass } from "@/lib/customer-pill-tabs";

type DashboardOrdersTab = "orders" | "history";

export function DashboardOrdersTabNav({
  activeTab,
}: {
  activeTab: DashboardOrdersTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard order views"
      className={customerPillTablistClass}
    >
      <Link
        href="/dashboard/orders"
        role="tab"
        aria-selected={activeTab === "orders"}
        className={customerPillTabClass(activeTab === "orders")}
      >
        Orders
      </Link>
      <Link
        href="/dashboard/orders-history"
        role="tab"
        aria-selected={activeTab === "history"}
        className={customerPillTabClass(activeTab === "history")}
      >
        Order History
      </Link>
    </div>
  );
}
