"use client";

import type { LucideIcon } from "lucide-react";
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

type DashboardNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

type DashboardNavSection = {
  title: string;
  links: DashboardNavLink[];
};

function isOrdersPath(path: string): boolean {
  return (
    path === "/dashboard/orders" ||
    path.startsWith("/dashboard/orders/") ||
    path === "/dashboard/orders-history" ||
    path.startsWith("/dashboard/orders-history/")
  );
}

const SECTIONS: DashboardNavSection[] = [
  {
    title: "Shopping",
    links: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
        match: (path) => path === "/dashboard",
      },
      {
        href: DASHBOARD_REQUESTED_ITEMS_ROUTE,
        label: "Requested items",
        icon: ClipboardList,
        match: (path) => path.startsWith("/dashboard/items/requested-items"),
      },
      {
        href: DASHBOARD_ADD_ITEM_ROUTES.productsActive,
        label: "Add item",
        icon: PlusCircle,
        match: (path) => path.startsWith("/dashboard/items/new/add-item"),
      },
      {
        href: "/dashboard/cart",
        label: "Cart",
        icon: ShoppingCart,
        match: (path) =>
          path === "/dashboard/cart" || path.startsWith("/dashboard/cart/"),
      },
    ],
  },
  {
    title: "Orders & shipping",
    links: [
      {
        href: "/dashboard/orders",
        label: "Orders",
        icon: Package,
        match: isOrdersPath,
      },
      {
        href: "/dashboard/barrels",
        label: "Barrels",
        icon: Box,
        match: (path) =>
          path === "/dashboard/barrels" || path.startsWith("/dashboard/barrels/"),
      },
      {
        href: "/dashboard/shipping",
        label: "Shipping",
        icon: Truck,
        match: (path) =>
          path === "/dashboard/shipping" || path.startsWith("/dashboard/shipping/"),
      },
    ],
  },
];

function NavLinkItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-sidebar-primary/15 text-sidebar-foreground shadow-sm ring-1 ring-sidebar-primary/25"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
          active
            ? "border-sidebar-primary/30 bg-sidebar-primary/20 text-sidebar-primary"
            : "border-sidebar-border/80 bg-sidebar-accent/50 text-sidebar-foreground/60 group-hover:border-sidebar-border group-hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

const ALL_LINKS = SECTIONS.flatMap((section) => section.links);

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-sidebar-primary/40 bg-sidebar-primary/15 text-sidebar-foreground"
          : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function DashboardNav({
  className,
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "mobile";
}) {
  const currentPath = usePathname() ?? "/dashboard";

  if (variant === "mobile") {
    return (
      <nav
        aria-label="Dashboard"
        className={cn("flex gap-2", className)}
      >
        {ALL_LINKS.map(({ href, label, icon, match }) => (
          <MobileNavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={match(currentPath)}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Dashboard"
      className={cn("flex flex-col gap-6", className)}
    >
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
            {section.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.links.map(({ href, label, icon, match }) => (
              <li key={href}>
                <NavLinkItem
                  href={href}
                  label={label}
                  icon={icon}
                  active={match(currentPath)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
