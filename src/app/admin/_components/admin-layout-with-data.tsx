import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import {
  AdminCustomerFilterBar,
  AdminCustomerFilterShell,
} from "@/components/admin/admin-customer-filter-shell";
import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { UserHeaderControls } from "@/components/user-header-controls";
import { AdminNotificationsBell } from "@/components/admin/admin-notifications-bell";
import { AdminNav } from "@/components/admin-nav";
import { loadAdminActivityNotificationSummary } from "@/data/admin-user-activity-events";
import { listProfilesForAdminPicker } from "@/data/customer-pricing-packages";
import { getOrCreateProfile } from "@/data/profiles";
import { countOpenSupportTickets } from "@/data/support-tickets";

export async function AdminLayoutWithData({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  try {
    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      null;
    await getOrCreateProfile(userId, email);
  } catch (error) {
    console.warn(
      "[Cart2Barrel] Could not ensure admin profile:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const [adminPickerUsers, activitySummary, openSupportCount] = await Promise.all([
    listProfilesForAdminPicker(),
    loadAdminActivityNotificationSummary(userId),
    countOpenSupportTickets(),
  ]);

  return (
    <AdminCustomerFilterShell users={adminPickerUsers}>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-border/80 px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <BrandLogoLink />
              <Link
                href="/admin/overview?tab=summary"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Admin
              </Link>
            </div>
            <AdminCustomerFilterBar users={adminPickerUsers} />
            <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
              <AdminNotificationsBell initial={activitySummary} />
              <Link
                href="/dashboard"
                prefetch={false}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                User app
              </Link>
              <UserHeaderControls />
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:gap-8 lg:py-8">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-6 rounded-xl border border-sidebar-border bg-sidebar/95 p-3 shadow-sm ring-1 ring-sidebar-border/60 backdrop-blur-sm">
              <AdminNav
                badges={{
                  itemRequests: activitySummary.itemRequestsUnread,
                  orders: activitySummary.ordersUnread,
                  support: openSupportCount,
                }}
              />
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <div className="mb-6 overflow-x-auto rounded-xl border border-sidebar-border bg-sidebar/90 p-2 shadow-sm ring-1 ring-sidebar-border/50 lg:hidden">
              <AdminNav
                variant="mobile"
                className="w-max min-w-full px-0.5 pb-0.5"
                badges={{
                  itemRequests: activitySummary.itemRequestsUnread,
                  orders: activitySummary.ordersUnread,
                }}
              />
            </div>
            {children}
          </div>
        </div>
      </div>
    </AdminCustomerFilterShell>
  );
}
