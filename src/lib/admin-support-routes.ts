export const ADMIN_SUPPORT_ROUTES = {
  contact: "/admin/support/contact",
  inbox: "/admin/support/inbox",
  ticket: (ticketId: string) =>
    `/admin/support/inbox/${encodeURIComponent(ticketId)}`,
} as const;

export const DASHBOARD_SUPPORT_ROUTES = {
  inbox: "/dashboard/support",
  ticket: (ticketId: string) =>
    `/dashboard/support/${encodeURIComponent(ticketId)}`,
} as const;
