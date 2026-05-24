"use client";

import { updateOutsidePurchaseServiceHandlingTiersAction } from "@/actions/update-outside-purchase-service-tiers";
import { AdminServiceHandlingTierEditor } from "@/components/admin/admin-service-handling-tier-editor";
import type { FeeTierServerPayload } from "@/lib/service-handling-tier-form";

type AdminOutsidePurchaseServiceFeePanelProps = {
  initialTiers: FeeTierServerPayload[];
};

export function AdminOutsidePurchaseServiceFeePanel({
  initialTiers,
}: AdminOutsidePurchaseServiceFeePanelProps) {
  return (
    <AdminServiceHandlingTierEditor
      title="Outside purchase service & handling"
      description={
        <>
          Published rates for products customers buy themselves and ship to Cart2Barrel
          staff (outside-purchase intake). Staff enter the customer&apos;s listed unit
          price; the matching band sets service &amp; handling per consumer unit. These
          tiers do not apply to in-app purchase quotes.
        </>
      }
      initialTiers={initialTiers}
      saveButtonLabel="Save outside purchase tiers"
      onSave={updateOutsidePurchaseServiceHandlingTiersAction}
    />
  );
}
