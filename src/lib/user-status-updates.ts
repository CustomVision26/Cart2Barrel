import type { UserStatusUpdateKind } from "@/db/schema";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";

export type UserStatusNavSection = "requested_items" | "orders";

export function userStatusUpdateNavSection(
  kind: UserStatusUpdateKind,
): UserStatusNavSection {
  switch (kind) {
    case "company_purchase_confirmed":
    case "purchase_tracking_updated":
    case "refund_approved":
    case "refund_rejected":
    case "product_return_fulfilled":
      return "orders";
    default:
      return "requested_items";
  }
}

export function userStatusHrefForActiveProduct(highlightId?: string): string {
  const base = DASHBOARD_ADD_ITEM_ROUTES.productsActive;
  if (!highlightId) return base;
  return `${base}?highlight=${encodeURIComponent(highlightId)}`;
}

export function userStatusHrefForBatchQuotes(highlightSessionId?: string): string {
  const base = DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive;
  if (!highlightSessionId) return base;
  return `${base}?highlight=${encodeURIComponent(highlightSessionId)}`;
}

export function userStatusHrefForOrders(highlightOrderId?: string): string {
  const base = "/dashboard/orders";
  if (!highlightOrderId) return base;
  return `${base}?highlight=${encodeURIComponent(highlightOrderId)}`;
}

export function userStatusHrefForDashboard(): string {
  return "/dashboard";
}

export function formatUserStatusRelativeTime(iso: string): string {
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
