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
  RotateCcw,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import {
  markAdminActivityEventsReadAction,
  markAllAdminActivityEventsReadAction,
} from "@/actions/admin-user-activity";
import type { AdminActivityNotificationSummary } from "@/data/admin-user-activity-events";
import type { AdminUserActivityEventKind } from "@/db/schema";
import { formatAdminActivityRelativeTime } from "@/lib/admin-user-activity";
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

function eventIcon(kind: AdminUserActivityEventKind) {
  switch (kind) {
    case "item_request_submitted":
      return ClipboardList;
    case "batch_quote_submitted":
    case "batch_estimate_accepted":
      return Package;
    case "checkout_payment_succeeded":
      return CreditCard;
    case "refund_request_submitted":
      return RotateCcw;
    case "product_return_requested":
    case "outside_purchase_return_submitted":
      return ShoppingBag;
    default:
      return Sparkles;
  }
}

type AdminNotificationsBellProps = {
  initial: AdminActivityNotificationSummary;
};

export function AdminNotificationsBell({ initial }: AdminNotificationsBellProps) {
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
      const res = await markAllAdminActivityEventsReadAction();
      if (res.ok) {
        setSummary({
          totalUnread: 0,
          itemRequestsUnread: 0,
          ordersUnread: 0,
          groups: [],
        });
        refreshFromServer();
      }
    });
  }

  function handleOpenEvent(eventId: string, href: string) {
    startTransition(async () => {
      await markAdminActivityEventsReadAction({ eventIds: [eventId] });
      setSummary((prev) => {
        const groups = prev.groups
          .map((group) => {
            const events = group.events.filter((e) => e.id !== eventId);
            if (events.length === 0) return null;
            return {
              ...group,
              events,
              unreadCount: events.length,
            };
          })
          .filter((g): g is NonNullable<typeof g> => g !== null);

        let itemRequestsUnread = 0;
        let ordersUnread = 0;
        for (const g of groups) {
          for (const e of g.events) {
            if (e.navSection === "item_requests") itemRequestsUnread += 1;
            else ordersUnread += 1;
          }
        }
        return {
          groups,
          itemRequestsUnread,
          ordersUnread,
          totalUnread: itemRequestsUnread + ordersUnread,
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
            ? `${totalUnread} unread customer updates`
            : "Customer activity notifications"
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
          <DialogTitle>Customer updates</DialogTitle>
          <DialogDescription>
            Grouped by shopper — new requests, payments, and status changes.
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {summary.itemRequestsUnread > 0 ? (
              <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                {summary.itemRequestsUnread} item request
                {summary.itemRequestsUnread === 1 ? "" : "s"}
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
          {summary.groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No new customer activity. You are caught up.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.groups.map((group) => (
                <li
                  key={group.clerkUserId}
                  className="overflow-hidden rounded-lg border border-border/80 bg-card/40"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {group.displayName}
                      </p>
                      {group.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {group.email}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {group.unreadCount}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {group.events.map((event) => {
                      const Icon = eventIcon(event.kind);
                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleOpenEvent(event.id, event.href)}
                            className={cn(
                              "flex w-full gap-3 px-3 py-2.5 text-left transition-colors",
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
                                  {formatAdminActivityRelativeTime(event.createdAt)}
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
                </li>
              ))}
            </ul>
          )}
        </div>
        {totalUnread > 0 ? (
          <div className="border-t border-border px-4 py-3">
            <Link
              href="/admin/item-requests/active-requests/queue"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Open item requests queue
            </Link>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
