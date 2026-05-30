"use client";

import Link from "next/link";
import { ChevronRight, Mail, MessageSquare } from "lucide-react";

import type { AdminSupportUserGroup } from "@/data/support-tickets";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { formatAdminActivityRelativeTime } from "@/lib/admin-user-activity";
import { RelativeTimeLabel } from "@/components/ui/relative-time-label";
import { cn } from "@/lib/utils";

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "awaiting_staff":
      return "Awaiting staff";
    case "awaiting_customer":
      return "Awaiting customer";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "open":
    case "awaiting_staff":
      return "bg-primary/15 text-primary";
    case "awaiting_customer":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "resolved":
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function AdminSupportInbox({ groups }: { groups: AdminSupportUserGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No support messages yet. When customers use Contact us, their tickets
        appear here grouped by account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.clerkUserId}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {group.displayName}
              </p>
              {group.email ? (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="size-3 shrink-0" aria-hidden />
                  {group.email}
                </p>
              ) : null}
            </div>
            {group.openTicketCount > 0 ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {group.openTicketCount} open
              </span>
            ) : null}
          </header>
          <ul className="divide-y divide-border">
            {group.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ADMIN_SUPPORT_ROUTES.ticket(ticket.id)}
                  prefetch={false}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                    <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {ticket.subject}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusClass(ticket.status),
                        )}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    {ticket.messagePreview ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {ticket.messagePreview}
                      </p>
                    ) : null}
                    <RelativeTimeLabel
                      iso={ticket.lastMessageAt}
                      className="mt-1 block text-xs text-muted-foreground"
                      formatRelative={formatAdminActivityRelativeTime}
                    />
                  </div>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
