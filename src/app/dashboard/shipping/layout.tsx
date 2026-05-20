import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DashboardShippingTabNav } from "@/components/dashboard/dashboard-shipping-tab-nav";
import { getBarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";

export default async function DashboardShippingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const data = await getBarrelShippingIntakePageData(userId);
  const showPricingTab = data.awaiting.length > 0 || data.submitted.length > 0;
  const pricingNeedsAttention = data.submitted.some(
    (row) =>
      row.outboundCharge &&
      !row.outboundCharge.paidAt &&
      row.outboundCharge.totalCents > 0 &&
      !row.outboundCharge.inCart,
  );

  return (
    <div className="space-y-6">
      <DashboardShippingTabNav
        showPricingTab={showPricingTab}
        pricingNeedsAttention={pricingNeedsAttention}
      />
      {children}
    </div>
  );
}
