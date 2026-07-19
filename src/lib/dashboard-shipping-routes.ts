export const DASHBOARD_SHIPPING_ROUTES = {
  tracking: "/dashboard/shipping",
  pricing: "/dashboard/shipping/pricing",
  /** Profile contact + shipping label (legacy `/address` redirects here). */
  address: "/dashboard/shipping/profile",
} as const;

export type DashboardShippingRoute =
  (typeof DASHBOARD_SHIPPING_ROUTES)[keyof typeof DASHBOARD_SHIPPING_ROUTES];
