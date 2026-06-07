import Link from "next/link";
import { Suspense } from "react";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { UserHeaderControls } from "@/components/user-header-controls";
import { Button } from "@/components/ui/button";

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
    <header className="border-b border-border/80 px-4 py-4 md:py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <BrandLogoLink priority />
        <nav className="flex items-center gap-2 sm:gap-3">
          {userId ?
            <>
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/how-it-works" prefetch={false} />}
              >
                How it works
              </Button>
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
          : <>
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/how-it-works" prefetch={false} />}
              >
                How it works
              </Button>
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
                nativeButton={false}
                render={<Link href="/signup" prefetch={false} />}
              >
                Sign up
              </Button>
            </>
          }
        </nav>
      </div>
    </header>
  );
}
