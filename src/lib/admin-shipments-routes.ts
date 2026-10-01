export const ADMIN_SHIPMENTS_ROUTES = {
  active: "/admin/shipments",
  history: "/admin/shipments-history",
  containerControl: "/admin/shipments-container-control",
} as const;

export type AdminShipmentsRoute =
  (typeof ADMIN_SHIPMENTS_ROUTES)[keyof typeof ADMIN_SHIPMENTS_ROUTES];
