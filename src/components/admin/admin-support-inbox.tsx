"use client";

import Link from "next/link";

import type { AdminSupportInboxGroup } from "@/data/support-tickets";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { cn } from "@/lib/utils";

export function AdminSupportInbox({ groups }: { groups: AdminSupportInboxGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No support messages yet. Customer complaints and issues will appear here,
        grouped by shopper.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {groups.map((group) => (
        <li
          key={group.clerkUserId}
          className="overflow-hidden rounded-xl border border-border/80 bg-card/40"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {group.displayName}
              </p>
              {group.email ?
                <p className="truncate text-xs text-muted-foreground">
                  {group.email}
                </p>
              : null}
            </div>
            {group.unreadCount > 0 ?
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {group.unreadCount} need{group.unreadCount === 1 ? "s" : ""}{" "}
                reply
              </span>
            : null}
          </div>
          <ul className="divide-y divide-border/50">
            {group.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ADMIN_SUPPORT_ROUTES.ticket(ticket.id)}
                  className={cn(
                    "flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-accent/40",
                    ticket.needsStaffAttention && "bg-amber-500/5",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {ticket.subject}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {ticket.ticketNumber}
                    </span>
                  </span>
                  {ticket.lastMessagePreview ?
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {ticket.lastMessagePreview}
                    </span>
                  : null}
                  <span className="text-[10px] capitalize text-muted-foreground">
                    {ticket.status.replace(/_/g, " ")} ·{" "}
                    {new Date(ticket.lastMessageAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
