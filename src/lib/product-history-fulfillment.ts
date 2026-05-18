import type { ItemRequestLineSnapshot } from "@/db/schema";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";

export function fulfillmentProductHistoryLabelFromSnapshots(
  snapshots: ItemRequestLineSnapshot[]
): string | null {
  let latest: ItemRequestLineSnapshot | null = null;
  for (const s of snapshots) {
    if (
      s.phase !== "checkout_paid_pending_delivery" &&
      s.phase !== "outside_purchase_checkout_paid" &&
      s.phase !== "company_purchase_pending_delivery"
    ) {
      continue;
    }
    if (
      !latest ||
      new Date(s.createdAt).getTime() > new Date(latest.createdAt).getTime()
    ) {
      latest = s;
    }
  }
  if (!latest) return null;
  if (latest.phase === "outside_purchase_checkout_paid") {
    return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
  }
  if (latest.phase === "company_purchase_pending_delivery") {
    return "Company Purchase: Pending Delivery";
  }
  return "Pending Delivery";
}

export function fulfillmentProductHistoryBadgeKindFromSnapshots(
  snapshots: ItemRequestLineSnapshot[],
): StatusBadgeKind | null {
  let latest: ItemRequestLineSnapshot | null = null;
  for (const s of snapshots) {
    if (
      s.phase !== "checkout_paid_pending_delivery" &&
      s.phase !== "outside_purchase_checkout_paid" &&
      s.phase !== "company_purchase_pending_delivery"
    ) {
      continue;
    }
    if (
      !latest ||
      new Date(s.createdAt).getTime() > new Date(latest.createdAt).getTime()
    ) {
      latest = s;
    }
  }
  if (!latest) return null;
  if (latest.phase === "outside_purchase_checkout_paid") {
    return "fullyReceived";
  }
  if (latest.phase === "company_purchase_pending_delivery") {
    return "companyPurchasePendingDelivery";
  }
  return "awaitingPurchase";
}
