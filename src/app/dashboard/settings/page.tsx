import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { ShippingAddressForm } from "@/components/shipping-address-form";
import { getPrimaryShippingAddress } from "@/data/addresses";
import {
  getOrCreateProfile,
  getProfileByClerkId,
  isOnboardingComplete,
} from "@/data/profiles";

export default async function DashboardSettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  let profile = await getProfileByClerkId(userId);
  if (!profile) {
    profile = await getOrCreateProfile(userId, email);
  }

  if (!(await isOnboardingComplete(userId, profile))) {
    redirect("/onboarding");
  }

  const shipping = await getPrimaryShippingAddress(userId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Profile &amp; address
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Account contact (billing / legal) and your Jamaican shipping label used
          for barrel delivery.
        </p>
      </div>
      <div className="flex w-full max-w-lg flex-col gap-8">
        <ProfileForm profile={profile} afterSaveRedirect="/dashboard/settings" />
        <ShippingAddressForm
          address={shipping}
          afterSaveRedirect="/dashboard/settings"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/" className="underline hover:text-foreground">
          Back to marketing home
        </Link>
      </p>
    </div>
  );
}
