"use client";

import type { LucideIcon } from "lucide-react";
import {
  Box,
  ClipboardList,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { cn } from "@/lib/utils";

type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

function isOrdersPath(path: string): boolean {
  return (
    path === "/admin/orders" ||
    path.startsWith("/admin/orders/") ||
    path === "/admin/orders-history" ||
    path.startsWith("/admin/orders-history/")
  );
}

const SECTIONS: AdminNavSection[] = [
  {
    title: "Commerce",
    links: [
      {
        href: "/admin/overview",
        label: "Overview",
        icon: LayoutDashboard,
        match: (path) => path === "/admin/overview" || path === "/admin",
      },
      {
        href: ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue,
        label: "Item requests",
        icon: ClipboardList,
        match: (path) => path.startsWith("/admin/item-requests"),
      },
      {
        href: "/admin/orders",
        label: "Orders",
        icon: ShoppingBag,
        match: isOrdersPath,
      },
    ],
  },
  {
    title: "Fulfillment",
    links: [
      {
        href: "/admin/purchase-orders",
        label: "Purchase orders",
        icon: Truck,
        match: (path) =>
          path === "/admin/purchase-orders" ||
          path.startsWith("/admin/purchase-orders/"),
      },
      {
        href: "/admin/packages",
        label: "Packages",
        icon: Package,
        match: (path) =>
          path === "/admin/packages" || path.startsWith("/admin/packages/"),
      },
      {
        href: "/admin/barrels",
        label: "Barrels",
        icon: Box,
        match: (path) =>
          path === "/admin/barrels" || path.startsWith("/admin/barrels/"),
      },
      {
        href: "/admin/shipments",
        label: "Shipments",
        icon: Warehouse,
        match: (path) =>
          path === "/admin/shipments" || path.startsWith("/admin/shipments/"),
      },
    ],
  },
  {
    title: "Catalog & team",
    links: [
      {
        href: "/admin/spotlight-products",
        label: "Spotlight",
        icon: Sparkles,
        match: (path) =>
          path === "/admin/spotlight-products" ||
          path.startsWith("/admin/spotlight-products/"),
      },
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        match: (path) =>
          path === "/admin/users" || path.startsWith("/admin/users/"),
      },
    ],
  },
];

function NavLinkItem({
  href,
  label,
  icon: Icon,
  active,
  badgeCount,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badgeCount?: number;
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
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

const ALL_LINKS = SECTIONS.flatMap((section) => section.links);

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
  badgeCount,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badgeCount?: number;
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
      {badgeCount != null && badgeCount > 0 ? (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

export type AdminNavBadges = {
  itemRequests?: number;
  orders?: number;
};

function navBadgeForHref(
  href: string,
  badges: AdminNavBadges | undefined,
): number | undefined {
  if (!badges) return undefined;
  if (
    href === ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue ||
    href.startsWith("/admin/item-requests")
  ) {
    return badges.itemRequests;
  }
  if (href === "/admin/orders") {
    return badges.orders;
  }
  return undefined;
}

export function AdminNav({
  className,
  variant = "sidebar",
  badges,
}: {
  className?: string;
  variant?: "sidebar" | "mobile";
  badges?: AdminNavBadges;
}) {
  const currentPath = usePathname() ?? "/admin";
  const { hrefWithFilter } = useAdminCustomerFilter();

  if (variant === "mobile") {
    return (
      <nav
        aria-label="Admin"
        className={cn("flex gap-2", className)}
      >
        {ALL_LINKS.map(({ href, label, icon, match }) => (
          <MobileNavLink
            key={href}
            href={hrefWithFilter(href)}
            label={label}
            icon={icon}
            active={match(currentPath)}
            badgeCount={navBadgeForHref(href, badges)}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Admin"
      className={cn("flex flex-col gap-6", className)}
    >
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
            {section.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.links.map(({ href, label, icon, match }) => {
              const active = match(currentPath);
              const navHref = hrefWithFilter(href);
              return (
                <li key={href}>
                  <NavLinkItem
                    href={navHref}
                    label={label}
                    icon={icon}
                    active={active}
                    badgeCount={navBadgeForHref(href, badges)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
