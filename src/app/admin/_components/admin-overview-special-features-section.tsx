import { AdminSpecialFeaturesManager } from "@/components/admin/admin-special-features-manager";
import { listSpecialFeatureOffersForAdmin } from "@/data/special-feature-offers";
import type { SpecialFeaturePackagingMode } from "@/lib/validations/special-feature-offer";

export async function AdminOverviewSpecialFeaturesSection() {
  const rows = await listSpecialFeatureOffersForAdmin();

  const offers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sizeLabel: r.sizeLabel,
    destinationLocation: r.destinationLocation,
    packagingMode: r.packagingMode as SpecialFeaturePackagingMode,
    priceUsdCents: r.priceUsdCents,
    airlineName: r.airlineName,
    travelAt: r.travelAt,
    airlineSecondBagUsdCents: r.airlineSecondBagUsdCents,
    airlineThirdBagUsdCents: r.airlineThirdBagUsdCents,
    airlineFourthBagUsdCents: r.airlineFourthBagUsdCents,
    airlineBagFeeExtraNote: r.airlineBagFeeExtraNote,
    notes: r.notes,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    isActive: r.isActive,
    containerOfferingId: r.containerOfferingId,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Special features
        </h2>
        <p className="text-sm text-muted-foreground">
          Timed suitcase offers. Create a draft here, link suitcase SKU(s) under{" "}
          <span className="font-medium text-foreground">Shipping containers</span>, then Publish to
          show the promo banner on user pages and suitcases on{" "}
          <span className="font-medium text-foreground">/dashboard/barrels</span>{" "}
          (in-app purchase or outside packaging).
        </p>
      </div>
      <AdminSpecialFeaturesManager offers={offers} />
    </div>
  );
}
