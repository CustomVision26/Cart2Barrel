"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { cn } from "@/lib/utils";

const tabClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function AdminSupportTabNav() {
  const pathname = usePathname();
  const contactHref = ADMIN_SUPPORT_ROUTES.contact;
  const inboxHref = ADMIN_SUPPORT_ROUTES.inbox;

  const linkClass = (href: string) =>
    tabClass(pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div
      role="tablist"
      aria-label="Support sections"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={contactHref}
        role="tab"
        aria-selected={pathname === contactHref}
        className={linkClass(contactHref)}
      >
        Hub contact
      </Link>
      <Link
        href={inboxHref}
        role="tab"
        aria-selected={
          pathname === inboxHref || pathname.startsWith(`${inboxHref}/`)
        }
        className={linkClass(inboxHref)}
      >
        Inbox
      </Link>
    </div>
  );
}
