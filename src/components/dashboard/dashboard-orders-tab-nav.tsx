import Link from "next/link";

import { cn } from "@/lib/utils";

type DashboardOrdersTab = "orders" | "history";

const tabLinkClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function DashboardOrdersTabNav({
  activeTab,
}: {
  activeTab: DashboardOrdersTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard order views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href="/dashboard/orders"
        role="tab"
        aria-selected={activeTab === "orders"}
        className={tabLinkClass(activeTab === "orders")}
      >
        Orders
      </Link>
      <Link
        href="/dashboard/orders-history"
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabLinkClass(activeTab === "history")}
      >
        Order History
      </Link>
    </div>
  );
}
