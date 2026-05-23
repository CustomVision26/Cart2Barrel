import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminCustomerFilterBar,
  AdminCustomerFilterShell,
} from "@/components/admin/admin-customer-filter-shell";
import { ClerkUserButton } from "@/components/clerk-user-button";
import { AdminNotificationsBell } from "@/components/admin/admin-notifications-bell";
import { AdminNav } from "@/components/admin-nav";
import { loadAdminActivityNotificationSummary } from "@/data/admin-user-activity-events";
import { listProfilesForAdminPicker } from "@/data/customer-pricing-packages";
import { getClerkSessionGate } from "@/lib/clerk-session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-center text-sm text-foreground">
          <p className="font-medium">Could not verify admin access</p>
          <p className="text-muted-foreground">{gate.message}</p>
        </div>
      </div>
    );
  }
  if (!gate.isAdmin) {
    redirect("/dashboard");
  }

  const adminPickerUsers = await listProfilesForAdminPicker();
  const activitySummary = await loadAdminActivityNotificationSummary(
    gate.userId,
  );

  return (
    <AdminCustomerFilterShell users={adminPickerUsers}>
      <div className="flex min-h-full flex-1 flex-col bg-background">
        <header className="border-b border-border/80 px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/admin/overview?tab=summary"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Admin
              </Link>
              <span className="text-xs text-muted-foreground">Cart2Barrel</span>
            </div>
            <AdminCustomerFilterBar users={adminPickerUsers} />
            <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
              <AdminNotificationsBell initial={activitySummary} />
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                User app
              </Link>
              <ClerkUserButton />
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
