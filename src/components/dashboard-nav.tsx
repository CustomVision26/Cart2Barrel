"use client";

import type { LucideIcon } from "lucide-react";
import {
  Box,
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Package,
  PlusCircle,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CUSTOMER_SIDEBAR_NAV_LINKS } from "@/lib/documentation/customer-ui-surfaces";
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

const ICON_BY_DOC_ID: Record<string, LucideIcon> = {
  "dashboard-overview": LayoutDashboard,
  "requested-items": ClipboardList,
  "add-item": PlusCircle,
  cart: ShoppingCart,
  orders: Package,
  barrels: Box,
  shipping: Truck,
  "support-messages": MessageCircle,
};

function isOrdersPath(path: string): boolean {
  return (
    path === "/dashboard/orders" ||
    path.startsWith("/dashboard/orders/") ||
    path === "/dashboard/orders-history" ||
    path.startsWith("/dashboard/orders-history/")
  );
}

function matchPathForDocId(docId: string, href: string): (path: string) => boolean {
  switch (docId) {
    case "dashboard-overview":
      return (path) => path === "/dashboard";
    case "requested-items":
      return (path) => path.startsWith("/dashboard/items/requested-items");
    case "add-item":
      return (path) => path.startsWith("/dashboard/items/new/add-item");
    case "cart":
      return (path) =>
        path === "/dashboard/cart" || path.startsWith("/dashboard/cart/");
    case "orders":
      return isOrdersPath;
    case "barrels":
      return (path) =>
        path === "/dashboard/barrels" || path.startsWith("/dashboard/barrels/");
    case "shipping":
      return (path) =>
        path === "/dashboard/shipping" || path.startsWith("/dashboard/shipping/");
    case "support-messages":
      return (path) => path.startsWith("/dashboard/support");
    default:
      return (path) => path === href || path.startsWith(`${href}/`);
  }
}

const SECTIONS: DashboardNavSection[] = (() => {
  const bySection = new Map<string, DashboardNavLink[]>();
  for (const link of CUSTOMER_SIDEBAR_NAV_LINKS) {
    const icon = ICON_BY_DOC_ID[link.docId];
    if (!icon) {
      throw new Error(`Missing dashboard nav icon for docId: ${link.docId}`);
    }
    const entry: DashboardNavLink = {
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

export type DashboardNavBadges = {
  requestedItems?: number;
  orders?: number;
};

function navBadgeForHref(
  href: string,
  badges: DashboardNavBadges | undefined,
): number | undefined {
  if (!badges) return undefined;
  const link = CUSTOMER_SIDEBAR_NAV_LINKS.find((item) => item.href === href);
  if (link?.docId === "requested-items") {
    return badges.requestedItems;
  }
  if (link?.docId === "orders") {
    return badges.orders;
  }
  return undefined;
}

export function DashboardNav({
  className,
  variant = "sidebar",
  badges,
}: {
  className?: string;
  variant?: "sidebar" | "mobile";
  badges?: DashboardNavBadges;
}) {
  const currentPath = usePathname() ?? "/dashboard";

  if (variant === "mobile") {
    return (
      <nav aria-label="Dashboard" className={cn("flex gap-2", className)}>
        {ALL_LINKS.map(({ href, label, icon, match }) => (
          <MobileNavLink
            key={href}
            href={href}
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
    <nav aria-label="Dashboard" className={cn("flex flex-col gap-6", className)}>
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
                  badgeCount={navBadgeForHref(href, badges)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
