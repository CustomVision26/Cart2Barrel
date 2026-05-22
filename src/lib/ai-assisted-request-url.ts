import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import type { PublicSpotlightVariant } from "@/data/spotlight-product-variants";
import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";

/** Deep link to AI-assisted request with product URL prefilled. */
export function aiAssistedRequestUrlWithProduct(productUrl: string): string {
  const params = new URLSearchParams({ productUrl });
  return `${DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}?${params.toString()}`;
}

/** Deep link from home spotlight with full curated product context. */
export function aiAssistedRequestUrlWithSpotlightProduct(
  product: Pick<PublicSpotlightProduct, "id" | "productUrl">,
): string {
  const params = new URLSearchParams({
    spotlightProductId: product.id,
    productUrl: product.productUrl,
  });
  return `${DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}?${params.toString()}`;
}

/** Deep link for a stored spotlight variant row. */
export function aiAssistedRequestUrlWithSpotlightVariant(
  product: Pick<PublicSpotlightProduct, "id">,
  variant: Pick<PublicSpotlightVariant, "id" | "productUrl">,
): string {
  const params = new URLSearchParams({
    spotlightProductId: product.id,
    spotlightVariantId: variant.id,
    productUrl: variant.productUrl,
  });
  return `${DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}?${params.toString()}`;
}
