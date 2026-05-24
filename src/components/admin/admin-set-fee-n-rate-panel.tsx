"use client";

import { updateMerchantPricingSettingsAction } from "@/actions/update-merchant-pricing-settings";
import { AdminServiceHandlingTierEditor } from "@/components/admin/admin-service-handling-tier-editor";
import type { ContainerPackingRates } from "@/lib/container-packing-fee";
import type { FeeTierServerPayload } from "@/lib/service-handling-tier-form";

type AdminSetFeeNRatePanelProps = {
  initialPackingFeePerLineCents: number;
  initialContainerPackingRates: ContainerPackingRates;
  initialTiers: FeeTierServerPayload[];
};

export function AdminSetFeeNRatePanel({
  initialPackingFeePerLineCents,
  initialContainerPackingRates,
  initialTiers,
}: AdminSetFeeNRatePanelProps) {
  return (
    <AdminServiceHandlingTierEditor
      title="Service & handling tiers (in-app purchases)"
      description={
        <>
          Global service &amp; handling bands for quotes and checkout when Cart2Barrel
          purchases on the customer&apos;s behalf. Each row is one price band per
          consumer unit. Packing and container fees are under{" "}
          <span className="font-medium text-foreground">
            Customer packages → General package fee
          </span>
          .
        </>
      }
      initialTiers={initialTiers}
      saveButtonLabel="Save in-app tiers"
      onSave={async (tiers) =>
        updateMerchantPricingSettingsAction({
          packingFeePerLineCents: initialPackingFeePerLineCents,
          containerPackingRates: initialContainerPackingRates,
          tiers,
        })
      }
    />
  );
}
