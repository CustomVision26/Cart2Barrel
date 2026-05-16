import { AdminBarrelsManager } from "@/components/admin/admin-barrels-manager";
import { listAllContainerOfferingsWithImagesForAdmin } from "@/data/container-offerings";

export default async function AdminBarrelsPage() {
  const rows = await listAllContainerOfferingsWithImagesForAdmin();
  const offerings = rows.map((r) => ({
    offering: {
      id: r.offering.id,
      name: r.offering.name,
      sizeLabel: r.offering.sizeLabel,
      priceUsdCents: r.offering.priceUsdCents,
      isActive: r.offering.isActive,
    },
    images: r.images.map((im) => ({
      id: im.id,
      imageUrl: im.imageUrl,
      sortIndex: im.sortIndex,
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shipping containers
        </h1>
        <p className="text-sm text-muted-foreground">
          Define the barrel and container options shoppers see on{" "}
          <span className="font-medium text-foreground">/dashboard/barrels</span>. Upload
          several photos per SKU. Use the arrows beside each thumbnail to change carousel order
          (left-to-right).
        </p>
      </div>
      <AdminBarrelsManager offerings={offerings} />
    </div>
  );
}
