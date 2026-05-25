import { AdminSpotlightProductsManager } from "@/components/admin/admin-spotlight-products-manager";
import { listAdminSpotlightProducts } from "@/data/spotlight-category-products";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

export default async function AdminSpotlightProductsPage() {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Spotlight products
        </h1>
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-foreground">
          {cu.message}
        </p>
      </div>
    );
  }

  const admin = isClerkAdmin(cu.user);
  let products: Awaited<ReturnType<typeof listAdminSpotlightProducts>> = [];
  if (admin) {
    try {
      products = await listAdminSpotlightProducts();
    } catch {
      products = [];
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Spotlight products
        </h1>
        <p className="text-sm text-muted-foreground">
          Add retailer product URLs for each home page carousel category. Expand
          Variants on a product to import SKU rows (SerpApi + page AI) or add them
          manually—shoppers see those options in the category dialog.
        </p>
      </div>
      {!admin ?
        <p className="rounded-lg border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
          Admin access is required to manage spotlight products.
        </p>
      : <AdminSpotlightProductsManager initialProducts={products} />}
    </div>
  );
}
