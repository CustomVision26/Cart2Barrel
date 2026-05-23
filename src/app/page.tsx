import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { ClerkUserButton } from "@/components/clerk-user-button";
import { CartHeaderLink } from "@/components/dashboard/cart-header-link";
import { HomeStorefront } from "@/components/marketing/home-storefront";
import { Button } from "@/components/ui/button";
import { getProfileByClerkId, isOnboardingComplete } from "@/data/profiles";
import { listActiveSpotlightProductsByCategory } from "@/data/spotlight-category-products";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (!profile || !(await isOnboardingComplete(userId, profile))) {
      redirect("/onboarding");
    }
  }

  let productsByCategory = {};
  try {
    productsByCategory = await listActiveSpotlightProductsByCategory();
  } catch {
    productsByCategory = {};
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink priority />
          <nav className="flex items-center gap-3">
            {userId ? (
              <>
                <Button variant="ghost" nativeButton={false} render={<Link href="/how-it-works" />}>
                  How it works
                </Button>
                <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard" />}>
                  Dashboard
                </Button>
                <CartHeaderLink />
                <ClerkUserButton />
              </>
            ) : (
              <>
                <Button variant="ghost" nativeButton={false} render={<Link href="/how-it-works" />}>
                  How it works
                </Button>
                <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button nativeButton={false} render={<Link href="/signup" />}>
                  Sign up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <HomeStorefront
        isSignedIn={Boolean(userId)}
        productsByCategory={productsByCategory}
      />
    </div>
  );
}
