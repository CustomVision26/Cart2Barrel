"use client";

import type { LucideIcon } from "lucide-react";
import {
  Box,
  BookOpen,
  ClipboardList,
  Headphones,
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
import { ADMIN_SIDEBAR_NAV_LINKS } from "@/lib/documentation/admin-ui-surfaces";
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

const ICON_BY_DOC_ID: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  "item-requests-active": ClipboardList,
  orders: ShoppingBag,
  "purchase-orders": Truck,
  packages: Package,
  barrels: Box,
  shipments: Warehouse,
  spotlight: Sparkles,
  users: Users,
  support: Headphones,
  "admin-guide": BookOpen,
};

function isOrdersPath(path: string): boolean {
  return (
    path === "/admin/orders" ||
    path.startsWith("/admin/orders/") ||
    path === "/admin/orders-history" ||
    path.startsWith("/admin/orders-history/")
  );
}

function matchPathForDocId(docId: string, href: string): (path: string) => boolean {
  switch (docId) {
    case "overview":
      return (path) => path === "/admin/overview" || path === "/admin";
    case "item-requests-active":
      return (path) => path.startsWith("/admin/item-requests");
    case "orders":
      return isOrdersPath;
    case "purchase-orders":
      return (path) =>
        path === "/admin/purchase-orders" ||
        path.startsWith("/admin/purchase-orders/");
    case "packages":
      return (path) =>
        path === "/admin/packages" || path.startsWith("/admin/packages/");
    case "barrels":
      return (path) =>
        path === "/admin/barrels" || path.startsWith("/admin/barrels/");
    case "shipments":
      return (path) =>
        path === "/admin/shipments" || path.startsWith("/admin/shipments/");
    case "spotlight":
      return (path) =>
        path === "/admin/spotlight-products" ||
        path.startsWith("/admin/spotlight-products/");
    case "users":
      return (path) => path === "/admin/users" || path.startsWith("/admin/users/");
    case "support":
      return (path) => path.startsWith("/admin/support");
    case "admin-guide":
      return (path) => path === href || path.startsWith(`${href}/`);
    default:
      return (path) => path === href || path.startsWith(`${href}/`);
  }
}

const SECTIONS: AdminNavSection[] = (() => {
  const bySection = new Map<string, AdminNavLink[]>();
  for (const link of ADMIN_SIDEBAR_NAV_LINKS) {
    const icon = ICON_BY_DOC_ID[link.docId];
    if (!icon) {
      throw new Error(`Missing admin nav icon for docId: ${link.docId}`);
    }
    const entry: AdminNavLink = {
      href: link.href,
      label: link.label,
      icon,
      match: matchPathForDocId(link.docId, link.href),
    };
    const existing = bySection.get(link.navSection) ?? [];
    existing.push(entry);
    bySection.set(link.navSection, existing);
  }
  return [...bySection.entries()].map(([title, links]) => ({ title, links }));
})();

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
      prefetch={false}
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
      prefetch={false}
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
  support?: number;
};

function navBadgeForDocId(
  docId: string,
  badges: AdminNavBadges | undefined,
): number | undefined {
  if (!badges) return undefined;
  if (docId === "item-requests-active") {
    return badges.itemRequests;
  }
  if (docId === "orders") {
    return badges.orders;
  }
  if (docId === "support") {
    return badges.support;
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
      <nav aria-label="Admin" className={cn("flex gap-2", className)}>
        {ADMIN_SIDEBAR_NAV_LINKS.map((link) => {
          const icon = ICON_BY_DOC_ID[link.docId];
          if (!icon) return null;
          const match = matchPathForDocId(link.docId, link.href);
          return (
            <MobileNavLink
              key={link.href}
              href={hrefWithFilter(link.href)}
              label={link.label}
              icon={icon}
              active={match(currentPath)}
              badgeCount={navBadgeForDocId(link.docId, badges)}
            />
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Admin" className={cn("flex flex-col gap-6", className)}>
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
            {section.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.links.map(({ href, label, icon, match }) => {
              const linkDef = ADMIN_SIDEBAR_NAV_LINKS.find((item) => item.href === href);
              const active = match(currentPath);
              const navHref = hrefWithFilter(href);
              return (
                <li key={href}>
                  <NavLinkItem
                    href={navHref}
                    label={label}
                    icon={icon}
                    active={active}
                    badgeCount={
                      linkDef ? navBadgeForDocId(linkDef.docId, badges) : undefined
                    }
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
