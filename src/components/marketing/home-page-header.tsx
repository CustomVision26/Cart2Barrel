import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "lucide-react";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { MarketingContactUs } from "@/components/marketing/marketing-contact-us";
import { UserHeaderControls } from "@/components/user-header-controls";
import { Button } from "@/components/ui/button";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";

type HomePageHeaderProps = {
  userId: string | null;
};

function CartHeaderLinkFallback() {
  return (
    <span
      className="inline-flex size-9 items-center justify-center rounded-md bg-muted/60"
      aria-hidden
    />
  );
}

export function HomePageHeader({ userId }: HomePageHeaderProps) {
  return (
    <header className="relative z-50 border-b border-border/80 bg-card/80 px-4 py-4 backdrop-blur-sm md:py-5">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <BrandLogoLink priority showWordmark />
        <nav className="flex items-center gap-1 sm:gap-2">
          <details className="relative hidden md:block">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
              Shop
              <ChevronDown className="size-4" aria-hidden />
            </summary>
            <div className="absolute left-0 z-50 mt-1 w-max min-w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              <Link
                href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
                prefetch={false}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                Get a quote
              </Link>
              <Link
                href="#spotlight"
                prefetch={false}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                Shop by category
              </Link>
              <Link
                href="#in-hub-products"
                prefetch={false}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                In-hub products
              </Link>
              <Link
                href="/dashboard/barrels"
                prefetch={false}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                Containers &amp; barrels
              </Link>
            </div>
          </details>
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            render={<Link href="/how-it-works" prefetch={false} />}
          >
            How It Works
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link href="#spotlight" prefetch={false} />}
          >
            Categories
          </Button>
          <Button
            size="lg"
            className="rounded-full"
            nativeButton={false}
            render={
              <Link
                href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
                prefetch={false}
              />
            }
          >
            Get a Quote
          </Button>
          {userId ? (
            <>
              <MarketingContactUs signedIn />
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/dashboard" prefetch={false} />}
              >
                Dashboard
              </Button>
              <Suspense fallback={<CartHeaderLinkFallback />}>
                <CartHeaderLink userId={userId} />
              </Suspense>
              <UserHeaderControls />
            </>
          ) : (
            <>
              <MarketingContactUs signedIn={false} />
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/login" prefetch={false} />}
              >
                Sign in
              </Button>
              <Button
                size="lg"
                className="rounded-full"
                nativeButton={false}
                render={<Link href="/signup" prefetch={false} />}
              >
                Sign up
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
