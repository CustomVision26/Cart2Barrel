"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { cn } from "@/lib/utils";

export type AdminBarrelsTab = "assign" | "history";

const tabLinkClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function AdminBarrelsTabNav() {
  const { hrefWithFilter } = useAdminCustomerFilter();
  const path = usePathname() ?? "";
  const activeTab: AdminBarrelsTab = path.endsWith("/assign-to-barrel-history")
    ? "history"
    : "assign";

  return (
    <div
      role="tablist"
      aria-label="Admin barrels views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={hrefWithFilter("/admin/barrels/assign-to-barrel")}
        role="tab"
        aria-selected={activeTab === "assign"}
        className={tabLinkClass(activeTab === "assign")}
      >
        Assign to barrel
      </Link>
      <Link
        href={hrefWithFilter("/admin/barrels/assign-to-barrel-history")}
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabLinkClass(activeTab === "history")}
      >
        Assign to barrel history
      </Link>
    </div>
  );
}
