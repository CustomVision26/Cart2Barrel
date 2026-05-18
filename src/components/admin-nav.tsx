"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

const links = [
  { href: "/admin/overview", label: "Overview" },
  { href: ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue, label: "Item requests" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/purchase-orders", label: "Purchase orders" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/barrels", label: "Barrels" },
  { href: "/admin/shipments", label: "Shipments" },
  { href: "/admin/users", label: "Users" },
] as const;

export function AdminNav() {
  const currentPath = usePathname() ?? "/admin";
  const { hrefWithFilter } = useAdminCustomerFilter();
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label }) => {
        const navHref = hrefWithFilter(href);
        const active =
          href === "/admin/overview"
            ? currentPath === "/admin/overview" || currentPath === "/admin"
            : href === ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue
              ? currentPath.startsWith("/admin/item-requests")
              : href === "/admin/orders"
                ? currentPath === "/admin/orders" ||
                  currentPath.startsWith("/admin/orders/") ||
                  currentPath === "/admin/orders-history" ||
                  currentPath.startsWith("/admin/orders-history/")
              : currentPath === href || currentPath.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={navHref}
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
