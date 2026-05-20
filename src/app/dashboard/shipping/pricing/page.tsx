import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { BarrelShippingPricingSection } from "@/components/shipping/barrel-shipping-pricing-section";
import {
  getPrimaryShippingAddress,
  isShippingAddressComplete,
} from "@/data/addresses";
import { getBarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";

export default async function DashboardShippingPricingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const [data, shippingAddress] = await Promise.all([
    getBarrelShippingIntakePageData(userId),
    getPrimaryShippingAddress(userId),
  ]);

  const hasReadyContainers = data.awaiting.length > 0 || data.submitted.length > 0;
  if (!hasReadyContainers) {
    redirect(DASHBOARD_SHIPPING_ROUTES.tracking);
  }

  const destinationCountry = shippingAddress?.country?.trim() ?? "Jamaica";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shipping pricing
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Itemized freight, customs, and pickup charges for containers ready to ship.
          Add published quotes to your cart and pay before we release your barrel to
          the courier.
        </p>
      </header>

      <BarrelShippingPricingSection
        data={data}
        destinationCountry={
          isShippingAddressComplete(shippingAddress) ? destinationCountry : "Jamaica"
        }
      />
    </div>
  );
}
