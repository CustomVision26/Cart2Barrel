"use client";

import { cn } from "@/lib/utils";
import type { SupportTicketMessageRow } from "@/data/support-tickets";
import { SupportTicketMessageImages } from "@/components/support/support-ticket-message-images";
import { SupportTicketMessageProductLinks } from "@/components/support/support-ticket-message-product-links";

type SupportTicketThreadProps = {
  messages: SupportTicketMessageRow[];
  viewerIsStaff: boolean;
  customerLabel?: string;
  className?: string;
};

function formatMessageDateTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SupportTicketThread({
  messages,
  viewerIsStaff,
  customerLabel = "You",
  className,
}: SupportTicketThreadProps) {
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No messages yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      {messages.map((message) => {
        const fromHub = message.isFromStaff;
        const alignRight = viewerIsStaff ? fromHub : !fromHub;
        const author =
          fromHub ? "Cart2Barrel support" : customerLabel;
        const hasBody = message.body.trim().length > 0;
        const sentAt = formatMessageDateTime(message.createdAt);

        return (
          <div
            key={message.id}
            className={cn("flex", alignRight ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[min(100%,36rem)] rounded-xl px-3 py-2 text-sm",
                fromHub ?
                  "bg-emerald-500/15 text-foreground ring-1 ring-emerald-500/35"
                : "bg-sky-500/15 text-foreground ring-1 ring-sky-500/35",
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    fromHub ? "text-emerald-200/90" : "text-sky-200/90",
                  )}
                >
                  {author}
                </p>
                {sentAt ?
                  <time
                    dateTime={message.createdAt}
                    className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                  >
                    {sentAt}
                  </time>
                : null}
              </div>
              {hasBody ?
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              : null}
              <SupportTicketMessageImages imageUrls={message.imageUrls} />
              <SupportTicketMessageProductLinks
                productLinks={message.productLinks}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
