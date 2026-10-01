"use client";

import Link from "next/link";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { ADMIN_SHIPMENTS_ROUTES } from "@/lib/admin-shipments-routes";
import { cn } from "@/lib/utils";

type AdminShipmentsTab = "shipments" | "history" | "container-control";

const tabClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function AdminShipmentsTabNav({
  activeTab,
}: {
  activeTab: AdminShipmentsTab;
}) {
  const { hrefWithFilter } = useAdminCustomerFilter();
  return (
    <div
      role="tablist"
      aria-label="Admin shipment views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={hrefWithFilter(ADMIN_SHIPMENTS_ROUTES.active)}
        role="tab"
        aria-selected={activeTab === "shipments"}
        className={tabClass(activeTab === "shipments")}
      >
        Shipments
      </Link>
      <Link
        href={hrefWithFilter(ADMIN_SHIPMENTS_ROUTES.history)}
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabClass(activeTab === "history")}
      >
        Shipping History
      </Link>
      <Link
        href={hrefWithFilter(ADMIN_SHIPMENTS_ROUTES.containerControl)}
        role="tab"
        aria-selected={activeTab === "container-control"}
        className={tabClass(activeTab === "container-control")}
      >
        Container Control
      </Link>
    </div>
  );
}
