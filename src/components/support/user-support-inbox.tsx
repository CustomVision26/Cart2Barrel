"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ChevronRight,
  History,
  MessageSquare,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  hideSupportTicketAction,
  restoreSupportTicketAction,
} from "@/actions/support-tickets";
import type { SupportTicketSummary } from "@/data/support-tickets";
import { Button } from "@/components/ui/button";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import {
  buildSupportInboxHref,
  type SupportInboxQueryInput,
} from "@/lib/support-inbox-params";
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
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function UserSupportInbox({
  tickets,
  mode,
  query,
  total,
}: {
  tickets: SupportTicketSummary[];
  mode: "inbox" | "history";
  query: SupportInboxQueryInput;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / query.ps));

  function onRemove(ticketId: string) {
    startTransition(async () => {
      const res = await hideSupportTicketAction({ ticketId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function onRestore(ticketId: string) {
    startTransition(async () => {
      const res = await restoreSupportTicketAction({ ticketId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {mode === "history" ?
          "No removed conversations yet."
        : <>
            You have no messages yet. Use{" "}
            <span className="font-medium text-foreground">Contact us</span> in
            the top bar to reach the hub team.
          </>
        }
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="flex items-stretch gap-1">
            <Link
              href={DASHBOARD_SUPPORT_ROUTES.ticket(ticket.id)}
              prefetch={false}
              className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                {mode === "history" ?
                  <History className="size-4 text-muted-foreground" aria-hidden />
                : <MessageSquare
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                }
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
                  {ticket.unreadFromStaff ?
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      New
                    </span>
                  : <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Read
                    </span>
                  }
                  {ticket.isRemoved ?
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                      Removed
                    </span>
                  : null}
                </div>
                {ticket.messagePreview ?
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {ticket.messagePreview}
                  </p>
                : null}
                <RelativeTimeLabel
                  iso={ticket.lastMessageAt}
                  className="mt-1 block text-xs text-muted-foreground"
                  formatRelative={formatUserStatusRelativeTime}
                />
              </div>
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
            <div className="flex shrink-0 items-center pr-2">
              {mode === "history" ?
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  title="Restore to Messages"
                  aria-label="Restore conversation"
                  onClick={() => onRestore(ticket.id)}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              : <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  title="Remove to History"
                  aria-label="Remove conversation"
                  onClick={() => onRemove(ticket.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 || total > query.ps ?
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            Showing {(query.page - 1) * query.ps + 1}–
            {Math.min(query.page * query.ps, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {query.page > 1 ?
              <Link
                href={buildSupportInboxHref(mode, {
                  ...query,
                  page: query.page - 1,
                })}
                className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
              >
                Previous
              </Link>
            : <span className="rounded-md border border-border/50 px-3 py-1.5 opacity-40">
                Previous
              </span>
            }
            <span className="tabular-nums">
              Page {query.page} / {totalPages}
            </span>
            {query.page < totalPages ?
              <Link
                href={buildSupportInboxHref(mode, {
                  ...query,
                  page: query.page + 1,
                })}
                className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
              >
                Next
              </Link>
            : <span className="rounded-md border border-border/50 px-3 py-1.5 opacity-40">
                Next
              </span>
            }
          </div>
        </div>
      : null}
    </div>
  );
}
