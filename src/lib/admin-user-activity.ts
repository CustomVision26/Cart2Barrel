import type { AdminUserActivityEventKind } from "@/db/schema";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { ADMIN_USERS_ROUTES } from "@/lib/admin-users-routes";
import { withAdminCustomerFilter } from "@/lib/admin-customer-filter";

export type AdminActivityNavSection = "item_requests" | "orders";

export function adminActivityEventNavSection(
  kind: AdminUserActivityEventKind,
): AdminActivityNavSection {
  switch (kind) {
    case "checkout_payment_succeeded":
    case "refund_request_submitted":
    case "product_return_requested":
    case "outside_purchase_return_submitted":
      return "orders";
    default:
      return "item_requests";
  }
}

export function adminActivityHrefForItemRequestQueue(
  customerClerkUserId: string,
  highlightId?: string,
): string {
  const base = withAdminCustomerFilter(
    ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue,
    customerClerkUserId,
  );
  if (!highlightId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}highlight=${encodeURIComponent(highlightId)}`;
}

export function adminActivityHrefForBatchSubmitted(
  customerClerkUserId: string,
  batchSessionId: string,
): string {
  const base = withAdminCustomerFilter(
    ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted,
    customerClerkUserId,
  );
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}highlight=${encodeURIComponent(batchSessionId)}`;
}

export function adminActivityHrefForOrders(
  customerClerkUserId: string,
  highlightOrderId?: string,
): string {
  const base = withAdminCustomerFilter("/admin/orders", customerClerkUserId);
  if (!highlightOrderId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}highlight=${encodeURIComponent(highlightOrderId)}`;
}

export function adminActivityHrefForPurchaseOrders(
  customerClerkUserId: string,
): string {
  return withAdminCustomerFilter(
    "/admin/purchase-orders",
    customerClerkUserId,
  );
}

export function adminActivityHrefForOutsidePurchase(
  customerClerkUserId: string,
): string {
  return withAdminCustomerFilter(
    ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsOutsidePurchase,
    customerClerkUserId,
  );
}

export function adminActivityHrefForAllUsers(
  customerClerkUserId?: string,
): string {
  if (!customerClerkUserId) return ADMIN_USERS_ROUTES.allUsers;
  return withAdminCustomerFilter(ADMIN_USERS_ROUTES.allUsers, customerClerkUserId);
}

export function adminActivityHrefForSupportTicket(ticketId: string): string {
  return ADMIN_SUPPORT_ROUTES.ticket(ticketId);
}

export function formatAdminActivityRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
