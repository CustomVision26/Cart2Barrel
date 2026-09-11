import { AdminSpotlightProductsManager } from "@/components/admin/admin-spotlight-products-manager";
import {
  defaultSpotlightCategoryRecords,
  listSpotlightCategoryRecords,
} from "@/data/spotlight-categories";
import { listAdminSpotlightProducts } from "@/data/spotlight-category-products";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  let categories = defaultSpotlightCategoryRecords();
  if (admin) {
    try {
      products = await listAdminSpotlightProducts();
    } catch {
      products = [];
    }
    try {
      categories = await listSpotlightCategoryRecords();
    } catch {
      categories = defaultSpotlightCategoryRecords();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Spotlight products
        </h1>
        <p className="text-sm text-muted-foreground">
          Add retailer product URLs for each home page carousel category. New
          products start unpublished. Publish a product and its category so
          shoppers see them on Home. Double-click a record to edit details and
          variants. Use Move on a row to send a product to another category.
          Rows marked Check retailer still show when a scheduled
          retailer check found a live listing change.
        </p>
      </div>
      {!admin ?
        <p className="rounded-lg border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
          Admin access is required to manage spotlight products.
        </p>
      : (
        <AdminSpotlightProductsManager
          initialProducts={products}
          categories={categories}
        />
      )}
    </div>
  );
}
