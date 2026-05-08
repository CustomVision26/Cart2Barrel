"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/items", label: "Requested items" },
  { href: "/dashboard/items/new", label: "Add item" },
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
