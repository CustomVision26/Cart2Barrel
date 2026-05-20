export const DASHBOARD_SHIPPING_ROUTES = {
  tracking: "/dashboard/shipping",
  pricing: "/dashboard/shipping/pricing",
  address: "/dashboard/shipping/address",
} as const;

export type DashboardShippingRoute =
  (typeof DASHBOARD_SHIPPING_ROUTES)[keyof typeof DASHBOARD_SHIPPING_ROUTES];
