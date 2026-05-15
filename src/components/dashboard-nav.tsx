"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: DASHBOARD_REQUESTED_ITEMS_ROUTE, label: "Requested items" },
  { href: DASHBOARD_ADD_ITEM_ROUTES.productsActive, label: "Add item" },
  { href: "/dashboard/cart", label: "Cart" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/barrels", label: "Barrels" },
  { href: "/dashboard/shipping", label: "Shipping" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function DashboardNav() {
  const currentPath = usePathname() ?? "/dashboard";
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? currentPath === "/dashboard"
            : href === DASHBOARD_ADD_ITEM_ROUTES.productsActive
              ? currentPath.startsWith(
                  "/dashboard/items/new/add-item/products"
                )
              : href === "/dashboard/orders"
                ? currentPath === "/dashboard/orders" ||
                  currentPath.startsWith("/dashboard/orders/") ||
                  currentPath === "/dashboard/orders-history" ||
                  currentPath.startsWith("/dashboard/orders-history/")
              : currentPath === href || currentPath.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
