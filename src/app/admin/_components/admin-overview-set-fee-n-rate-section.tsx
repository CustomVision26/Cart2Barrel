import { AdminOutsidePurchaseServiceFeePanel } from "@/components/admin/admin-outside-purchase-service-fee-panel";
import { AdminSetFeeNRatePanel } from "@/components/admin/admin-set-fee-n-rate-panel";
import { getMerchantPricingForAdminEditor } from "@/data/merchant-pricing-settings";

export async function AdminOverviewSetFeeNRateSection() {
  const pricing = await getMerchantPricingForAdminEditor();

  const inAppTierPayload = pricing.tiers.map((t) => ({
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));

  const outsidePurchaseTierPayload = pricing.outsidePurchaseTiers.map((t) => ({
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));

  return (
    <div className="space-y-6">
      <AdminSetFeeNRatePanel
        initialPackingFeePerLineCents={pricing.packingFeePerLineCents}
        initialContainerPackingRates={pricing.containerPackingRates}
        initialTiers={inAppTierPayload}
      />
      <AdminOutsidePurchaseServiceFeePanel
        initialTiers={outsidePurchaseTierPayload}
      />
    </div>
  );
}
