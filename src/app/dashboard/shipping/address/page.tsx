import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { DashboardShippingAddressHeader } from "@/components/dashboard/dashboard-shipping-address-header";
import { ShippingAddressForm } from "@/components/shipping-address-form";
import { getPrimaryShippingAddress } from "@/data/addresses";
import {
  getOrCreateProfile,
  getProfileByClerkId,
  isOnboardingComplete,
} from "@/data/profiles";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";

export default async function DashboardShippingAddressPage() {
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
  const afterSave = DASHBOARD_SHIPPING_ROUTES.address;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <DashboardShippingAddressHeader />
      </div>
      <div className="flex w-full max-w-lg flex-col gap-8">
        <ProfileForm profile={profile} afterSaveRedirect={afterSave} />
        <ShippingAddressForm address={shipping} afterSaveRedirect={afterSave} />
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/" className="underline hover:text-foreground">
          Back to marketing home
        </Link>
      </p>
    </div>
  );
}
