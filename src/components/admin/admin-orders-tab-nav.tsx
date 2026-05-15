import Link from "next/link";

import { cn } from "@/lib/utils";

type AdminOrdersTab = "orders" | "history";

const tabClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function AdminOrdersTabNav({
  activeTab,
}: {
  activeTab: AdminOrdersTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Admin order inventory views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href="/admin/orders"
        role="tab"
        aria-selected={activeTab === "orders"}
        className={tabClass(activeTab === "orders")}
      >
        Orders
      </Link>
      <Link
        href="/admin/orders-history"
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabClass(activeTab === "history")}
      >
        Order History
      </Link>
    </div>
  );
}
