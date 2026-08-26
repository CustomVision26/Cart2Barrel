import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShippingAddressHeader } from "@/components/dashboard/dashboard-shipping-address-header";
import { ShippingAddressBook } from "@/components/shipping/shipping-address-book";
import { listShippingAddressesForUser } from "@/data/addresses";
import {
  getOrCreateProfile,
  getProfileByClerkId,
  isOnboardingComplete,
} from "@/data/profiles";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";

/** Shopper contact + shipping labels (`/dashboard/shipping/profile`). */
export default async function DashboardShippingProfilePage() {
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

  const addresses = await listShippingAddressesForUser(userId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <DashboardShippingAddressHeader />
      </div>
      <ShippingAddressBook
        addresses={addresses}
        contactDefaults={{
          fullName: profile.fullName ?? "",
          phone: profile.phone ?? "",
        }}
      />
      <p className="text-xs text-muted-foreground">
        <Link href="/" className="underline hover:text-foreground">
          Back to marketing home
        </Link>
        <span className="mx-2 text-border">·</span>
        <Link
          href={DASHBOARD_SHIPPING_ROUTES.tracking}
          className="underline hover:text-foreground"
        >
          Shipping tracking
        </Link>
      </p>
    </div>
  );
}
