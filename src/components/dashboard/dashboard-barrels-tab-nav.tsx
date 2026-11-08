"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { customerPillTabClass, customerPillTablistClass } from "@/lib/customer-pill-tabs";

export type DashboardBarrelsTab = "shop" | "product_to_barrel" | "history";

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
      className={customerPillTablistClass}
    >
      <Link
        href="/dashboard/barrels"
        role="tab"
        aria-selected={activeTab === "shop"}
        className={customerPillTabClass(activeTab === "shop")}
      >
        Shop Containers
      </Link>
      <Link
        href="/dashboard/barrels/product-to-barrel"
        role="tab"
        aria-selected={activeTab === "product_to_barrel"}
        className={customerPillTabClass(activeTab === "product_to_barrel")}
      >
        Product to Barrel
      </Link>
      <Link
        href="/dashboard/barrels/product-to-barrel-history"
        role="tab"
        aria-selected={activeTab === "history"}
        className={customerPillTabClass(activeTab === "history")}
      >
        Product to Barrel History
      </Link>
    </div>
  );
}
