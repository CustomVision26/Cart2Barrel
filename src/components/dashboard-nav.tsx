"use client";

import {
  Box,
  ClipboardList,
  LayoutDashboard,
  Package,
  PlusCircle,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: DASHBOARD_REQUESTED_ITEMS_ROUTE, label: "Requested items", icon: ClipboardList },
  { href: DASHBOARD_ADD_ITEM_ROUTES.productsActive, label: "Add item", icon: PlusCircle },
  { href: "/dashboard/cart", label: "Cart", icon: ShoppingCart },
  { href: "/dashboard/orders", label: "Orders", icon: Package },
  { href: "/dashboard/barrels", label: "Barrels", icon: Box },
  { href: "/dashboard/shipping", label: "Shipping", icon: Truck },
] as const;

export function DashboardNav() {
  const currentPath = usePathname() ?? "/dashboard";
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => {
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
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-70")}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
