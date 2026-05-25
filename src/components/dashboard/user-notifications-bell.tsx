"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  CreditCard,
  Package,
  Headphones,
  PartyPopper,
  RotateCcw,
  ShieldBan,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  markAllUserStatusUpdateEventsReadAction,
  markUserStatusUpdateEventsReadAction,
} from "@/actions/user-status-updates";
import type { UserStatusNotificationSummary } from "@/data/user-status-update-events";
import type { UserStatusUpdateKind } from "@/db/schema";
import { formatUserStatusRelativeTime } from "@/lib/user-status-updates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function eventIcon(kind: UserStatusUpdateKind) {
  switch (kind) {
    case "estimate_ready":
    case "batch_estimate_ready":
      return ClipboardList;
    case "item_out_of_stock":
      return XCircle;
    case "company_purchase_confirmed":
    case "purchase_tracking_updated":
      return Package;
    case "refund_approved":
      return CreditCard;
    case "refund_rejected":
      return RotateCcw;
    case "product_return_fulfilled":
    case "outside_purchase_return_estimate_ready":
      return ShoppingBag;
    case "account_welcome":
      return PartyPopper;
    case "account_suspended":
      return ShieldBan;
    case "account_reinstated":
      return ShieldCheck;
    case "support_ticket_staff_reply":
      return Headphones;
    default:
      return Sparkles;
  }
}

type UserNotificationsBellProps = {
  initial: UserStatusNotificationSummary;
};

export function UserNotificationsBell({ initial }: UserNotificationsBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(initial);
  const [pending, startTransition] = useTransition();

  const totalUnread = summary.totalUnread;

  function refreshFromServer() {
    router.refresh();
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      const res = await markAllUserStatusUpdateEventsReadAction();
      if (res.ok) {
        setSummary({
          totalUnread: 0,
          requestedItemsUnread: 0,
          ordersUnread: 0,
          events: [],
        });
        refreshFromServer();
      }
    });
  }

  function handleOpenEvent(eventId: string, href: string) {
    startTransition(async () => {
      await markUserStatusUpdateEventsReadAction({ eventIds: [eventId] });
      setSummary((prev) => {
        const events = prev.events.filter((e) => e.id !== eventId);
        let requestedItemsUnread = 0;
        let ordersUnread = 0;
        for (const e of events) {
          if (e.navSection === "requested_items") requestedItemsUnread += 1;
          else ordersUnread += 1;
        }
        return {
          events,
          requestedItemsUnread,
          ordersUnread,
          totalUnread: requestedItemsUnread + ordersUnread,
        };
      });
      setOpen(false);
      router.push(href);
      refreshFromServer();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        )}
        aria-label={
          totalUnread > 0
            ? `${totalUnread} unread status updates`
            : "Status update notifications"
        }
      >
        <Bell className="size-4" aria-hidden />
        {totalUnread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(85vh,640px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12">
          <DialogTitle>Status updates</DialogTitle>
          <DialogDescription>
            Staff updates on your estimates, orders, and products.
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {summary.requestedItemsUnread > 0 ? (
              <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                {summary.requestedItemsUnread} product
                {summary.requestedItemsUnread === 1 ? "" : "s"}
              </span>
            ) : null}
            {summary.ordersUnread > 0 ? (
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                {summary.ordersUnread} order
                {summary.ordersUnread === 1 ? "" : "s"}
              </span>
            ) : null}
            {totalUnread > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-8 gap-1.5 text-xs"
                disabled={pending}
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {summary.events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No new updates. You are caught up.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.events.map((event) => {
                const Icon = eventIcon(event.kind);
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleOpenEvent(event.id, event.href)}
                      className={cn(
                        "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        "hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
                      )}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {event.title}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatUserStatusRelativeTime(event.createdAt)}
                          </span>
                        </span>
                        {event.body ? (
                          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {event.body}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {totalUnread > 0 ? (
          <div className="border-t border-border px-4 py-3">
            <Link
              href="/dashboard/items/new/add-item/products/active"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View active products
            </Link>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
