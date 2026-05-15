"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { cn } from "@/lib/utils";

type AdminActiveRequestsSubTabNavProps = {
  quoteHistoryCount: number;
};

export function AdminActiveRequestsSubTabNav({
  quoteHistoryCount,
}: AdminActiveRequestsSubTabNavProps) {
  const pathname = usePathname();
  const queueHref = ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue;
  const quoteHistoryHref = ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQuoteHistory;

  const linkClass = (href: string) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      pathname === href
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  return (
    <div
      role="tablist"
      aria-label="Active requests sections"
      className="flex flex-wrap gap-1 border-b border-border pb-px"
    >
      <Link
        href={queueHref}
        role="tab"
        aria-selected={pathname === queueHref}
        className={linkClass(queueHref)}
      >
        Queue
      </Link>
      <Link
        href={quoteHistoryHref}
        role="tab"
        aria-selected={pathname === quoteHistoryHref}
        className={linkClass(quoteHistoryHref)}
      >
        Quote history
        {quoteHistoryCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[10px] text-muted-foreground">
            {quoteHistoryCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
