import Link from "next/link";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { DashboardNav } from "@/components/dashboard-nav";
import { getClerkSessionGate } from "@/lib/clerk-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getClerkSessionGate();
  const showAdminEntry = gate.ok && gate.isAdmin;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Cart2Barrel
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            {showAdminEntry ?
              <Link
                href="/admin/overview?tab=summary"
                className="text-sm font-medium text-primary hover:text-primary/90"
              >
                Admin
              </Link>
            : null}
            <CartHeaderLink />
            <ClerkUserButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:gap-8 lg:py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 rounded-xl border border-sidebar-border bg-sidebar/95 p-3 shadow-sm ring-1 ring-sidebar-border/60 backdrop-blur-sm">
            <DashboardNav />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6 overflow-x-auto rounded-xl border border-sidebar-border bg-sidebar/90 p-2 shadow-sm ring-1 ring-sidebar-border/50 lg:hidden">
            <DashboardNav variant="mobile" className="w-max min-w-full px-0.5 pb-0.5" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
