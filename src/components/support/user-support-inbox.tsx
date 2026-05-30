"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

import type { SupportTicketSummary } from "@/data/support-tickets";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { formatUserStatusRelativeTime } from "@/lib/user-status-updates";
import { RelativeTimeLabel } from "@/components/ui/relative-time-label";
import { cn } from "@/lib/utils";

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "awaiting_staff":
      return "With support";
    case "awaiting_customer":
      return "Reply from hub";
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
    case "awaiting_customer":
      return "bg-primary/15 text-primary";
    case "open":
    case "awaiting_staff":
      return "bg-muted text-muted-foreground";
    case "resolved":
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function UserSupportInbox({ tickets }: { tickets: SupportTicketSummary[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        You have no messages yet. Use{" "}
        <span className="font-medium text-foreground">Contact us</span> in the top
        bar to reach the hub team.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={DASHBOARD_SUPPORT_ROUTES.ticket(ticket.id)}
            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-foreground">{ticket.subject}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    statusClass(ticket.status),
                  )}
                >
                  {statusLabel(ticket.status)}
                </span>
                {ticket.unreadFromStaff ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    New
                  </span>
                ) : null}
              </div>
              {ticket.messagePreview ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {ticket.messagePreview}
                </p>
              ) : null}
              <RelativeTimeLabel
                iso={ticket.lastMessageAt}
                className="mt-1 block text-xs text-muted-foreground"
                formatRelative={formatUserStatusRelativeTime}
              />
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
