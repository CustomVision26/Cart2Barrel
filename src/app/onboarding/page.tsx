import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { HomePageContent } from "@/components/marketing/home-page-content";
import { UserHeaderControls } from "@/components/user-header-controls";
import { ShippingAddressForm } from "@/components/shipping-address-form";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { getOrCreateProfile, isOnboardingComplete } from "@/data/profiles";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  const profile = await getOrCreateProfile(userId, email);
  const shipping = await getPrimaryShippingAddress(userId);

  if (await isOnboardingComplete(userId, profile)) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="fixed inset-0 z-0 overflow-y-auto">
        <div className="pointer-events-none min-h-full" aria-hidden inert>
          <HomePageContent userId={null} />
        </div>
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-[1] bg-background/35 backdrop-blur-[2px]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-full flex-1 flex-col">
        <header className="border-b border-border/80 bg-background/70 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <BrandLogoLink />
            <UserHeaderControls />
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center px-4 py-10">
          <div className="mb-8 w-full max-w-lg space-y-2 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step 1 of your account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Contact &amp; shipping address
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Save your name, phone, and delivery address as one record. You can add
              more addresses later and keep one as primary.
            </p>
          </div>
          <ShippingAddressForm
            address={shipping}
            contactDefaults={{
              fullName: profile.fullName ?? "",
              phone: profile.phone ?? "",
            }}
            afterSaveRedirect="/"
            showSkip
            forcePrimary
          />
        </main>
      </div>
    </div>
  );
}
