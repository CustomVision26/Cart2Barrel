import Link from "next/link";

import { AdminCustomerFilterShell } from "@/components/admin/admin-customer-filter-shell";
import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { UserHeaderControls } from "@/components/user-header-controls";

export function AdminLayoutFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminCustomerFilterShell users={[]}>
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
            <div className="h-9 min-w-0 flex-1 animate-pulse rounded-lg bg-muted/60" />
            <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
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
            <div className="sticky top-6 h-64 animate-pulse rounded-xl border border-sidebar-border bg-muted/30" />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AdminCustomerFilterShell>
  );
}
