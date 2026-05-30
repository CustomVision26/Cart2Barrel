"use client";

import { formatUserStatusRelativeTime } from "@/lib/user-status-updates";
import { cn } from "@/lib/utils";
import type { SupportTicketMessageRow } from "@/data/support-tickets";
import { SupportTicketMessageImages } from "@/components/support/support-ticket-message-images";
import { RelativeTimeLabel } from "@/components/ui/relative-time-label";

type SupportTicketThreadProps = {
  messages: SupportTicketMessageRow[];
  viewerIsStaff: boolean;
  customerLabel?: string;
};

export function SupportTicketThread({
  messages,
  viewerIsStaff,
  customerLabel = "You",
}: SupportTicketThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {messages.map((message) => {
        const fromHub = message.isFromStaff;
        const alignRight = viewerIsStaff ? fromHub : !fromHub;
        const author =
          fromHub ? "Cart2Barrel support" : customerLabel;
        const hasBody = message.body.trim().length > 0;

        return (
          <div
            key={message.id}
            className={cn("flex", alignRight ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[min(100%,36rem)] rounded-xl px-3 py-2 text-sm",
                fromHub
                  ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                  : "bg-muted text-foreground",
              )}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {author}
              </p>
              {hasBody ?
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              : null}
              <SupportTicketMessageImages imageUrls={message.imageUrls} />
              <RelativeTimeLabel
                iso={message.createdAt}
                className="mt-1 block text-[11px] text-muted-foreground"
                formatRelative={formatUserStatusRelativeTime}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
