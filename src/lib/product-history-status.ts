import type {
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import {
  auditSnapshotStatusHeadline,
} from "@/lib/item-request-line-audit-status";
import {
  itemRequestStatusLabel,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { outsidePurchaseWorkflowBadgeKind } from "@/lib/outside-purchase-display";
import {
  fulfillmentProductHistoryBadgeKindFromSnapshots,
  fulfillmentProductHistoryLabelFromSnapshots,
} from "@/lib/product-history-fulfillment";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";
import { itemRequestWorkflowBadgeKind } from "@/lib/status-badge-map";

const FULFILLMENT_SNAPSHOT_PHASES = new Set<ItemRequestLineSnapshot["phase"]>([
  "checkout_paid_pending_delivery",
  "outside_purchase_checkout_paid",
  "company_purchase_pending_delivery",
  "warehouse_delivery_received",
  "product_return_requested",
  "product_return_tracking_saved",
  "customer_refund_request_submitted",
]);

function latestFulfillmentSnapshot(
  snapshots: ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot | null {
  let latest: ItemRequestLineSnapshot | null = null;
  for (const snap of snapshots) {
    if (!FULFILLMENT_SNAPSHOT_PHASES.has(snap.phase)) continue;
    if (
      !latest ||
      new Date(snap.createdAt).getTime() > new Date(latest.createdAt).getTime()
    ) {
      latest = snap;
    }
  }
  return latest;
}

export function resolveProductHistoryStatusDisplay(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
  options?: {
    returnRequest?: OutsidePurchaseReturnRequest | null;
    fulfillmentLabelOverride?: string | null;
  },
): { label: string; badgeKind: StatusBadgeKind; title?: string } {
  const returnRequest = options?.returnRequest ?? null;

  if (isOutsidePurchaseRequest(request)) {
    const label = itemRequestStatusLabelForDisplay(request, returnRequest);
    return {
      label,
      badgeKind: outsidePurchaseWorkflowBadgeKind(request, returnRequest),
      title: request.status,
    };
  }

  const fulfillmentLabel =
    options?.fulfillmentLabelOverride ??
    fulfillmentProductHistoryLabelFromSnapshots(snapshots);
  if (fulfillmentLabel) {
    return {
      label: fulfillmentLabel,
      badgeKind:
        fulfillmentProductHistoryBadgeKindFromSnapshots(snapshots) ??
        itemRequestWorkflowBadgeKind(request.status),
      title: fulfillmentLabel,
    };
  }

  const latest = latestFulfillmentSnapshot(snapshots);
  if (latest) {
    const headline = auditSnapshotStatusHeadline(latest);
    return {
      label: headline,
      badgeKind:
        fulfillmentProductHistoryBadgeKindFromSnapshots([latest]) ??
        itemRequestWorkflowBadgeKind(request.status),
      title: headline,
    };
  }

  const workflowLabel = itemRequestStatusLabel(request.status);
  return {
    label: workflowLabel,
    badgeKind: itemRequestWorkflowBadgeKind(request.status),
    title: request.status,
  };
}
