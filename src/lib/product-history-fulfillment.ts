import type { ItemRequestLineSnapshot } from "@/db/schema";
import { auditSnapshotStatusHeadline } from "@/lib/item-request-line-audit-status";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

/** Snapshot phases that reflect post-checkout fulfillment for product history. */
export const TRACKED_FULFILLMENT_PHASES = new Set<ItemRequestLineSnapshot["phase"]>([
  "checkout_paid_pending_delivery",
  "outside_purchase_checkout_paid",
  "company_purchase_pending_delivery",
  "warehouse_delivery_received",
  "product_return_requested",
  "product_return_tracking_saved",
  "customer_refund_request_submitted",
]);

export function latestTrackedFulfillmentSnapshot(
  snapshots: ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot | null {
  let latest: ItemRequestLineSnapshot | null = null;
  for (const snap of snapshots) {
    if (!TRACKED_FULFILLMENT_PHASES.has(snap.phase)) continue;
    if (
      !latest ||
      new Date(snap.createdAt).getTime() > new Date(latest.createdAt).getTime()
    ) {
      latest = snap;
    }
  }
  return latest;
}

function warehouseDeliveryLabelFromCondition(
  condition: WarehouseReceiveCondition,
): string {
  switch (condition) {
    case "good":
      return "Delivery received: good - awaiting barrel";
    case "damaged":
      return "Delivery received: item damaged";
    case "missing":
      return "Delivery received: item missing";
    case "wrong_item":
      return "Delivery received: wrong item";
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

function warehouseDeliveryBadgeKindFromCondition(
  condition: WarehouseReceiveCondition,
): StatusBadgeKind {
  switch (condition) {
    case "good":
      return "fullyReceived";
    case "damaged":
      return "partialReceived";
    case "missing":
      return "missingItem";
    case "wrong_item":
      return "customerResend";
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

export function productHistoryLabelFromSnapshot(
  snap: ItemRequestLineSnapshot,
): string {
  switch (snap.phase) {
    case "warehouse_delivery_received":
    case "warehouse_delivery_received_prior": {
      const wr = parseWarehouseReceiptMemo(snap.auditMemo);
      if (wr) return warehouseDeliveryLabelFromCondition(wr.condition);
      return auditSnapshotStatusHeadline(snap);
    }
    case "outside_purchase_checkout_paid":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "checkout_paid_pending_delivery":
      return "Checkout complete · awaiting company purchase";
    case "product_return_requested":
    case "product_return_tracking_saved":
    case "customer_refund_request_submitted":
      return auditSnapshotStatusHeadline(snap);
    default:
      return auditSnapshotStatusHeadline(snap);
  }
}

export function productHistoryBadgeKindFromSnapshot(
  snap: ItemRequestLineSnapshot,
): StatusBadgeKind {
  switch (snap.phase) {
    case "warehouse_delivery_received":
    case "warehouse_delivery_received_prior": {
      const wr = parseWarehouseReceiptMemo(snap.auditMemo);
      if (wr) return warehouseDeliveryBadgeKindFromCondition(wr.condition);
      return "fullyReceived";
    }
    case "outside_purchase_checkout_paid":
      return "fullyReceived";
    case "company_purchase_pending_delivery":
      return "companyPurchasePendingDelivery";
    case "checkout_paid_pending_delivery":
      return "awaitingPurchase";
    case "product_return_requested":
    case "product_return_tracking_saved":
      return "companyPurchasePendingDelivery";
    case "customer_refund_request_submitted":
      return "awaitingPurchase";
    default:
      return "awaitingPurchase";
  }
}

export function fulfillmentProductHistoryLabelFromSnapshots(
  snapshots: ItemRequestLineSnapshot[],
): string | null {
  const latest = latestTrackedFulfillmentSnapshot(snapshots);
  if (!latest) return null;
  return productHistoryLabelFromSnapshot(latest);
}

export function fulfillmentProductHistoryBadgeKindFromSnapshots(
  snapshots: ItemRequestLineSnapshot[],
): StatusBadgeKind | null {
  const latest = latestTrackedFulfillmentSnapshot(snapshots);
  if (!latest) return null;
  return productHistoryBadgeKindFromSnapshot(latest);
}
