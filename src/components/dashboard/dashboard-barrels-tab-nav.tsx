"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type DashboardBarrelsTab = "shop" | "product_to_barrel" | "history";

const tabLinkClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function DashboardBarrelsTabNav() {
  const path = usePathname() ?? "";
  const activeTab: DashboardBarrelsTab =
    path.endsWith("/product-to-barrel-history") ? "history"
    : path.includes("/product-to-barrel") ? "product_to_barrel"
    : "shop";

  return (
    <div
      role="tablist"
      aria-label="Barrels views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href="/dashboard/barrels"
        role="tab"
        aria-selected={activeTab === "shop"}
        className={tabLinkClass(activeTab === "shop")}
      >
        Shop containers
      </Link>
      <Link
        href="/dashboard/barrels/product-to-barrel"
        role="tab"
        aria-selected={activeTab === "product_to_barrel"}
        className={tabLinkClass(activeTab === "product_to_barrel")}
      >
        Product to barrel
      </Link>
      <Link
        href="/dashboard/barrels/product-to-barrel-history"
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabLinkClass(activeTab === "history")}
      >
        Product to barrel history
      </Link>
    </div>
  );
}
