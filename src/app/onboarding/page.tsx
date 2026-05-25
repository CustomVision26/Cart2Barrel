import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { ContactUsHeaderButton } from "@/components/support/contact-us-header-button";
import { UserHeaderControls } from "@/components/user-header-controls";
import { ProfileForm } from "@/components/profile-form";
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
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <BrandLogoLink />
          <div className="flex items-center gap-1">
            <ContactUsHeaderButton />
            <UserHeaderControls />
          </div>
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
            Add your account name and phone (billing and legal contact), then your
            delivery address anywhere in the world for barrel shipping.
          </p>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-8">
          <ProfileForm
            profile={profile}
            afterSaveRedirect="/onboarding"
            showSkip
          />
          <ShippingAddressForm address={shipping} afterSaveRedirect="/" />
        </div>
      </main>
    </div>
  );
}
