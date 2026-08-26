import { AdminHubStockProductsManager } from "@/components/admin/admin-hub-stock-products-manager";
import { listHubStockProductsForAdmin } from "@/data/hub-stock-products";
import { loadHubShipFromSettings } from "@/data/hub-ship-from";
import { isShippoConfigured } from "@/lib/shippo";

export async function AdminOverviewHubStockSection() {
  let rows: Awaited<ReturnType<typeof listHubStockProductsForAdmin>> = [];
  try {
    rows = await listHubStockProductsForAdmin();
  } catch {
    rows = [];
  }
  const products = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sizeLabel: r.sizeLabel,
    colorLabel: r.colorLabel,
    description: r.description,
    priceUsdCents: r.priceUsdCents,
    stockQty: r.stockQty,
    parcelWeightOz: r.parcelWeightOz,
    parcelLengthIn: r.parcelLengthIn,
    parcelWidthIn: r.parcelWidthIn,
    parcelHeightIn: r.parcelHeightIn,
    isActive: r.isActive,
    images: r.images,
  }));

  const shipFrom = await loadHubShipFromSettings();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          In-hub products
        </h2>
        <p className="text-sm text-muted-foreground">
          Inventory already at the hub. Add package weight and size so Shippo can rate
          US delivery. Click{" "}
          <span className="font-medium text-foreground">Publish</span> to show SKUs on the
          home page. Shoppers can add published products to cart without requesting an
          estimate. After checkout, US-address orders appear on{" "}
          <span className="font-medium text-foreground">/admin/orders</span> awaiting staff
          shipping; overseas-container orders appear on{" "}
          <span className="font-medium text-foreground">/admin/purchase-orders</span>.
        </p>
      </div>
      <AdminHubStockProductsManager
        products={products}
        shipFrom={shipFrom}
        shippoConfigured={isShippoConfigured()}
      />
    </div>
  );
}
