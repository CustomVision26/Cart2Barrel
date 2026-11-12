/** Customer “Requested items” submission routes under `/dashboard/items`. */

export const DASHBOARD_ITEMS_ROOT = "/dashboard/items" as const;

/** Hub for requested items; submission uses the AI-assisted request flow. */
export const DASHBOARD_REQUESTED_ITEMS_ROUTE =
  "/dashboard/items/requested-items" as const;

export const DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE =
  "/dashboard/items/requested-items/ai-assisted-request" as const;

export const DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE =
  "/dashboard/items/requested-items/shopping-list-request" as const;

export const DASHBOARD_BUDGET_BARREL_ROUTE =
  "/dashboard/items/requested-items/budget-barrel" as const;
