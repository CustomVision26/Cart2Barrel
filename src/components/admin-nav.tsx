"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/item-requests", label: "Item requests" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/barrels", label: "Barrels" },
  { href: "/admin/shipments", label: "Shipments" },
  { href: "/admin/users", label: "Users" },
] as const;

export function AdminNav() {
  const currentPath = usePathname() ?? "/admin";
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label }) => {
        const active =
          href === "/admin"
            ? currentPath === "/admin"
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
