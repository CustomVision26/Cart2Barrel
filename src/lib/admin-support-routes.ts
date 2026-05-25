export const ADMIN_SUPPORT_ROUTES = {
  contact: "/admin/support/contact",
  inbox: "/admin/support/inbox",
  ticket: (ticketId: string) => `/admin/support/inbox/${ticketId}`,
} as const;
