export const ADMIN_SHIPMENTS_ROUTES = {
  active: "/admin/shipments",
  history: "/admin/shipments-history",
} as const;

export type AdminShipmentsRoute =
  (typeof ADMIN_SHIPMENTS_ROUTES)[keyof typeof ADMIN_SHIPMENTS_ROUTES];
