import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { BarrelShippingIntakeSection } from "@/components/shipping/barrel-shipping-intake-section";
import {
  getPrimaryShippingAddress,
  isShippingAddressComplete,
} from "@/data/addresses";
import { getBarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";

export const maxDuration = 60;

export default async function DashboardShippingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const [data, shippingAddress] = await Promise.all([
    getBarrelShippingIntakePageData(userId),
    getPrimaryShippingAddress(userId).catch((e) => {
      console.error("[DashboardShippingPage] address", e);
      return undefined;
    }),
  ]);

  const shippingAddressComplete = isShippingAddressComplete(shippingAddress);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shipment tracking
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When you add a container, freight, customs clearance, and pickup
          charges appear below. Continue to the{" "}
          <span className="font-medium text-foreground">Pricing</span> tab for
          itemized amounts. After freight is paid, this tab shows the
          container&apos;s current shipment stage.
        </p>
      </header>

      <BarrelShippingIntakeSection
        data={data}
        shippingAddress={shippingAddress}
        shippingAddressComplete={shippingAddressComplete}
      />
    </div>
  );
}
