"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { cn } from "@/lib/utils";

const TABS = [
  { href: ADMIN_SUPPORT_ROUTES.contact, label: "Hub contact" },
  { href: ADMIN_SUPPORT_ROUTES.inbox, label: "Inbox" },
] as const;

export function AdminSupportTabNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Support sections"
      className="flex flex-wrap gap-2 border-b border-border/80 pb-4"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active ?
                "border-primary/40 bg-primary/15 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
