import { AdminBarrelsManager } from "@/components/admin/admin-barrels-manager";
import { listAllContainerOfferingsWithImagesForAdmin } from "@/data/container-offerings";
import {
  listEligibleSpecialFeatureRefsForContainerForm,
  listSpecialFeatureOffersForAdmin,
} from "@/data/special-feature-offers";

export async function AdminOverviewShippingContainersSection() {
  const [rows, specialFeatureRows] = await Promise.all([
    listAllContainerOfferingsWithImagesForAdmin(),
    listSpecialFeatureOffersForAdmin(),
  ]);

  const specialFeatures =
    listEligibleSpecialFeatureRefsForContainerForm(specialFeatureRows);

  const offerings = rows.map((r) => ({
    offering: {
      id: r.offering.id,
      name: r.offering.name,
      sizeLabel: r.offering.sizeLabel,
      kind: r.offering.kind,
      priceUsdCents: r.offering.priceUsdCents,
      isActive: r.offering.isActive,
      specialFeatureOfferId: r.specialFeature?.id ?? null,
      linkedSpecialFeatureOfferId: r.offering.specialFeatureOfferId ?? null,
      specialFeaturePublished: r.specialFeature?.isPublishedLive ?? false,
    },
    images: r.images.map((im) => ({
      id: im.id,
      imageUrl: im.imageUrl,
      sortIndex: im.sortIndex,
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Shipping containers
        </h2>
        <p className="text-sm text-muted-foreground">
          Define the barrel and container options shoppers see on{" "}
          <span className="font-medium text-foreground">/dashboard/barrels</span>. Create timed
          specials under{" "}
          <span className="font-medium text-foreground">Special features</span>, then link suitcase
          SKU(s) here with{" "}
          <span className="font-medium text-foreground">Special feature offer</span>. Use{" "}
          <span className="font-medium text-foreground">Publish</span> or{" "}
          <span className="font-medium text-foreground">Unpublish</span> on each catalog
          card after double-clicking a color-coded table row (barrels, bins, and special
          suitcases). Upload photos per SKU; use the arrows beside each thumbnail to change
          carousel order.
        </p>
      </div>
      <AdminBarrelsManager
        offerings={offerings}
        specialFeatures={specialFeatures}
      />
    </div>
  );
}
