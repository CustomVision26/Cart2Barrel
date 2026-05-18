import { AdminSetFeeNRatePanel } from "@/components/admin/admin-set-fee-n-rate-panel";
import { getMerchantPricingForAdminEditor } from "@/data/merchant-pricing-settings";

export async function AdminOverviewSetFeeNRateSection() {
  const pricing = await getMerchantPricingForAdminEditor();

  const tierPayload = pricing.tiers.map((t) => ({
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));

  return (
    <div className="space-y-6">
      <AdminSetFeeNRatePanel
        initialPackingFeePerLineCents={pricing.packingFeePerLineCents}
        initialContainerPackingRates={pricing.containerPackingRates}
        initialTiers={tierPayload}
      />
    </div>
  );
}
