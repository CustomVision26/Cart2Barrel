import { AdminStarterBundleMarqueePublishButton } from "@/components/admin/admin-starter-bundle-marquee-publish-button";
import { AdminStarterBundlesManager } from "@/components/admin/admin-starter-bundles-manager";
import { isStarterBundleMarqueePublished } from "@/data/starter-bundle-marquee-settings";
import { listStarterBundlesForAdmin } from "@/data/starter-bundles";
import { isStarterBundleStatus } from "@/lib/starter-bundles";

export async function AdminOverviewStarterBundlesSection() {
  const [rows, marqueePublished] = await Promise.all([
    listStarterBundlesForAdmin(),
    isStarterBundleMarqueePublished(),
  ]);
  const bundles = rows.map((row) => ({
    id: row.bundle.id,
    name: row.bundle.name,
    description: row.bundle.description,
    imageUrl: row.bundle.imageUrl,
    barrelSize: row.bundle.barrelSize,
    barrelFillLevel: row.bundle.barrelFillLevel,
    status: isStarterBundleStatus(row.bundle.status) ? row.bundle.status : "draft",
    updatedAt: row.bundle.updatedAt,
    merchandiseSubtotalCents: row.merchandiseSubtotalCents,
    items: row.items.map((item) => ({
      clientKey: item.id,
      productName: item.productName,
      quantity: item.quantity,
      estimatedUnitPriceCents: item.estimatedUnitPriceCents,
      productSize: item.productSize ?? "",
      productColor: item.productColor ?? "",
      retailerUrl: item.retailerUrl ?? "",
      productImageUrl: item.productImageUrl ?? "",
    })),
  }));

  const hasPublishedBundle = bundles.some((bundle) => bundle.status === "published");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Starter Bundles
          </h2>
          <AdminStarterBundleMarqueePublishButton
            published={marqueePublished}
            canPublish={hasPublishedBundle}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Fixed shopping lists shoppers can compare and submit for an estimate. Published
          bundles appear at{" "}
          <span className="font-medium text-foreground">/starter-bundles</span>. Click{" "}
          <span className="font-medium text-foreground">Published</span> to show them on the
          Home marquee. Submissions join{" "}
          <span className="font-medium text-foreground">List quotes</span> as source Starter
          Bundle.
        </p>
      </div>
      <AdminStarterBundlesManager bundles={bundles} />
    </div>
  );
}
