import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <CartHeaderLink />
            <UserButton />
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
