import Link from "next/link";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { DashboardNav } from "@/components/dashboard-nav";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cu = await safeCurrentUser();
  const showAdminEntry =
    cu.ok && cu.user != null && isClerkAdmin(cu.user);

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
                href="/admin"
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
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8">
        <aside className="hidden w-52 shrink-0 md:block">
          <DashboardNav />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6 md:hidden">
            <DashboardNav />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
