import Link from "next/link";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { UserHeaderControls } from "@/components/user-header-controls";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { UserNotificationsBell } from "@/components/dashboard/user-notifications-bell";
import { UserDocumentationDialogLazy } from "@/components/documentation/user-documentation-dialog-lazy";
import { ContactUsDialogLazy } from "@/components/support/contact-us-dialog-lazy";
import { DashboardNav } from "@/components/dashboard-nav";
import { getUserCartHeaderCount } from "@/data/cart-header-count";
import { loadHubContactSettings } from "@/data/hub-contact-settings";
import { countUserUnreadSupportTickets } from "@/data/support-tickets";
import { loadUserStatusNotificationSummary } from "@/data/user-status-update-events";

export function DashboardHeaderFallback({
  showAdminEntry = false,
}: {
  showAdminEntry?: boolean;
}) {
  return (
    <header className="border-b border-border/80 px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <BrandLogoLink priority />
        <div className="flex items-center gap-3">
          <Link
            href="/"
            prefetch={false}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          <UserDocumentationDialogLazy />
          {showAdminEntry ?
            <Link
              href="/admin/overview?tab=summary"
              prefetch={false}
              className="text-sm font-medium text-primary hover:text-primary/90"
            >
              Admin
            </Link>
          : null}
          <div className="size-9 animate-pulse rounded-md bg-muted/60" aria-hidden />
          <div className="size-9 animate-pulse rounded-md bg-muted/60" aria-hidden />
          <UserHeaderControls />
        </div>
      </div>
    </header>
  );
}

export async function DashboardHeader({
  userId,
  showAdminEntry,
}: {
  userId: string;
  showAdminEntry: boolean;
}) {
  const [statusSummary, hubContact, cartCount] = await Promise.all([
    loadUserStatusNotificationSummary(userId),
    loadHubContactSettings(),
    getUserCartHeaderCount(userId),
  ]);

  return (
    <header className="border-b border-border/80 px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <BrandLogoLink priority />
        <div className="flex items-center gap-3">
          <Link
            href="/"
            prefetch={false}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          <UserDocumentationDialogLazy />
          {showAdminEntry ?
            <Link
              href="/admin/overview?tab=summary"
              prefetch={false}
              className="text-sm font-medium text-primary hover:text-primary/90"
            >
              Admin
            </Link>
          : null}
          <ContactUsDialogLazy hubContact={hubContact} />
          <UserNotificationsBell initial={statusSummary} />
          <CartHeaderLink userId={userId} count={cartCount} />
          <UserHeaderControls />
        </div>
      </div>
    </header>
  );
}

export function DashboardNavFallback({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  if (variant === "mobile") {
    return (
      <div className="mb-6 overflow-x-auto rounded-xl border border-sidebar-border bg-sidebar/90 p-2 shadow-sm ring-1 ring-sidebar-border/50 lg:hidden">
        <DashboardNav
          variant="mobile"
          className="w-max min-w-full px-0.5 pb-0.5"
        />
      </div>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-6 rounded-xl border border-sidebar-border bg-sidebar/95 p-3 shadow-sm ring-1 ring-sidebar-border/60 backdrop-blur-sm">
        <DashboardNav />
      </div>
    </aside>
  );
}

export async function DashboardNavWithBadges({
  userId,
  variant = "desktop",
}: {
  userId: string;
  variant?: "desktop" | "mobile";
}) {
  const [statusSummary, messagesUnread] = await Promise.all([
    loadUserStatusNotificationSummary(userId),
    countUserUnreadSupportTickets(userId),
  ]);
  const badges = {
    requestedItems: statusSummary.requestedItemsUnread,
    orders: statusSummary.ordersUnread,
    messages: messagesUnread,
  };

  if (variant === "mobile") {
    return (
      <div className="mb-6 overflow-x-auto rounded-xl border border-sidebar-border bg-sidebar/90 p-2 shadow-sm ring-1 ring-sidebar-border/50 lg:hidden">
        <DashboardNav
          variant="mobile"
          className="w-max min-w-full px-0.5 pb-0.5"
          badges={badges}
        />
      </div>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-6 rounded-xl border border-sidebar-border bg-sidebar/95 p-3 shadow-sm ring-1 ring-sidebar-border/60 backdrop-blur-sm">
        <DashboardNav badges={badges} />
      </div>
    </aside>
  );
}
