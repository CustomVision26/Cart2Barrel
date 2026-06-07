/** Deep links for Add item (dashboard). */
export const DASHBOARD_ADD_ITEM_ROUTES = {
  /** Products index; redirects to `productsActive` (or `productsHistory` when `?tab=history`). */
  products: "/dashboard/items/new/add-item/products",
  productsActive: "/dashboard/items/new/add-item/products/active",
  productsHistory: "/dashboard/items/new/add-item/products/history",
  /** Legacy path `/product-history` redirects here. */
  productHistory: "/dashboard/items/new/add-item/products/history",
  /** Batch quotes index; redirects to `batchQuotesActive`. */
  batchQuotes: "/dashboard/items/new/add-item/batch-quotes",
  batchQuotesActive: "/dashboard/items/new/add-item/batch-quotes/active",
  /** Legacy `/batch-history` redirects to active batch quotes. */
  batchHistory: "/dashboard/items/new/add-item/batch-quotes/active",
} as const;
