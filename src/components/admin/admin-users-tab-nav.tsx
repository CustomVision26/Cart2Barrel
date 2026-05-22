"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_USERS_ROUTES } from "@/lib/admin-users-routes";
import { cn } from "@/lib/utils";

const tabClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function AdminUsersTabNav() {
  const pathname = usePathname();
  const allUsersHref = ADMIN_USERS_ROUTES.allUsers;
  const assignHref = ADMIN_USERS_ROUTES.assignAdmin;
  const logHref = ADMIN_USERS_ROUTES.grantLog;

  const linkClass = (href: string) => tabClass(pathname === href);

  return (
    <div
      role="tablist"
      aria-label="User management sections"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={allUsersHref}
        role="tab"
        aria-selected={pathname === allUsersHref}
        className={linkClass(allUsersHref)}
      >
        All users
      </Link>
      <Link
        href={assignHref}
        role="tab"
        aria-selected={pathname === assignHref}
        className={linkClass(assignHref)}
      >
        Assign admin
      </Link>
      <Link
        href={logHref}
        role="tab"
        aria-selected={pathname === logHref}
        className={linkClass(logHref)}
      >
        Grant log
      </Link>
    </div>
  );
}
