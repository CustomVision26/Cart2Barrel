import type { ItemRequest, ItemRequestLineSnapshot, OutsidePurchaseReturnRequest } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";

type OutsidePurchaseStatusAudience = "admin" | "customer";
import {
  warehouseReceiveConditionLabel,
  type WarehouseReceiveCondition,
} from "@/lib/warehouse-receive-condition";

export type OutsidePurchaseDisplayRequest = Pick<
  ItemRequest,
  | "status"
  | "source"
  | "outsidePurchaseReference"
  | "productUrl"
  | "outsidePurchasePaymentPromptedAt"
  | "outsidePurchaseReceivedCondition"
> & {
  /** Optional so partial callers still satisfy the type; absent ⇒ treat as published (legacy). */
  outsidePurchasePublishedAt?: ItemRequest["outsidePurchasePublishedAt"];
  /** Optional so partial callers still satisfy the type; absent ⇒ unresolved. */
  outsidePurchaseMissingResolvedAt?: ItemRequest["outsidePurchaseMissingResolvedAt"];
};

/** Customer marked a `missing` outside-purchase line as resolved. */
export function isOutsidePurchaseMissingResolved(
  request: OutsidePurchaseDisplayRequest,
): boolean {
  return Boolean(request.outsidePurchaseMissingResolvedAt);
}

export function parseOutsidePurchaseReceivedCondition(
  raw: string | null | undefined,
): WarehouseReceiveCondition | null {
  const v = raw?.trim();
  if (
    v === "good" ||
    v === "damaged" ||
    v === "missing" ||
    v === "wrong_item"
  ) {
    return v;
  }
  return null;
}

function promptedSuffix(request: OutsidePurchaseDisplayRequest): string {
  return request.outsidePurchasePaymentPromptedAt ? " · prompted" : "";
}

/** Audit / timeline phase when the customer submits a return-to-retailer request. */
export const OUTSIDE_PURCHASE_RETURN_REQUESTED_PHASE_LABEL =
  "Customer submitted return-to-retailer request";

/** Customer submitted a return-to-retailer request; staff has not published an estimate yet. */
export const OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL =
  "Return requested · awaiting estimate";

/** Audit / timeline phase when staff publish the return service estimate. */
export const OUTSIDE_PURCHASE_RETURN_ESTIMATE_PUBLISHED_PHASE_LABEL =
  "Return estimate published";

/** Status after the customer accepts a return estimate and owes the transit fee. */
export const OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL =
  "Payment due · return to retailer prompted";

/** Checkout order-summary caption for return-transit fee line items. */
export const OUTSIDE_PURCHASE_RETURN_TRANSIT_CHECKOUT_CAPTION =
  "Transit fee to return this product to the courier (pay before drop-off).";

export function outsidePurchaseReturnTransitCheckoutCaption(
  source: ItemRequest["source"],
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): string | null {
  if (source !== "outside_purchase" || !returnRequest) {
    return null;
  }
  if (
    returnRequest.status === "estimate_accepted" ||
    returnRequest.status === "paid"
  ) {
    return OUTSIDE_PURCHASE_RETURN_TRANSIT_CHECKOUT_CAPTION;
  }
  return null;
}

export function outsidePurchaseReturnStatusLabel(
  row: Pick<OutsidePurchaseReturnRequest, "status">,
): string | null {
  switch (row.status) {
    case "submitted":
      return OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL;
    case "estimate_ready":
      return "Return estimate ready";
    case "estimate_accepted":
      return OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL;
    case "paid":
      return "Return paid · drop off at carrier";
    case "cancelled":
      return "Return request cancelled";
    default:
      return null;
  }
}

/** Published line in return-estimate-ready — show Published in limited admin workflow. */
export function outsidePurchaseShowsPublishedWorkflowWhileLimited(
  request: Pick<ItemRequest, "source" | "outsidePurchasePublishedAt">,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  return (
    request.source === "outside_purchase" &&
    request.outsidePurchasePublishedAt != null &&
    returnRequest?.status === "estimate_ready"
  );
}

const OUTSIDE_PURCHASE_RETURN_WORKFLOW_SNAPSHOT_PHASES = [
  "outside_purchase_return_estimate_accepted",
  "outside_purchase_return_estimate_ready",
  "outside_purchase_return_requested",
] as const satisfies readonly ItemRequestLineSnapshot["phase"][];

function latestOutsidePurchaseSnapshotMs(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[],
  phase: ItemRequestLineSnapshot["phase"],
): number | null {
  let latest: number | null = null;
  for (const snap of snapshots) {
    if (snap.phase !== phase) continue;
    const ms = new Date(snap.createdAt).getTime();
    if (latest == null || ms > latest) latest = ms;
  }
  return latest;
}

/** After reinstate, keep showing an open return workflow (e.g. estimate ready). */
export function outsidePurchaseReturnStatusSuppressedAfterReinstate(
  returnRequest: Pick<OutsidePurchaseReturnRequest, "status"> | null | undefined,
  _snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[] | undefined,
  _audience: OutsidePurchaseStatusAudience = "customer",
): boolean {
  if (returnRequest?.status === "estimate_ready") return false;
  if (returnRequest?.status === "submitted") return false;
  return false;
}

export function isOutsidePurchaseActiveReturnPhase(
  status: OutsidePurchaseReturnRequest["status"] | undefined,
): status is "submitted" | "estimate_ready" | "estimate_accepted" | "paid" {
  return (
    status === "submitted" ||
    status === "estimate_ready" ||
    status === "estimate_accepted" ||
    status === "paid"
  );
}

/**
 * Service-fee checkout snapshot is the latest return-workflow milestone (or there
 * is no return workflow) — stale return labels must not override paid · service fee.
 */
export function outsidePurchaseReturnWorkflowSupersededByCheckout(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[] | undefined,
): boolean {
  if (!snapshots?.length) return false;

  const checkoutAt = latestOutsidePurchaseSnapshotMs(
    snapshots,
    "outside_purchase_checkout_paid",
  );
  if (checkoutAt == null) return false;

  for (const phase of OUTSIDE_PURCHASE_RETURN_WORKFLOW_SNAPSHOT_PHASES) {
    const returnAt = latestOutsidePurchaseSnapshotMs(snapshots, phase);
    if (returnAt != null && returnAt > checkoutAt) {
      return false;
    }
  }
  return true;
}

/** Fallback when return row is missing but audit shows an active return phase. */
export function outsidePurchaseSnapshotReturnStatusLabel(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[] | undefined,
): string | null {
  if (!snapshots?.length) return null;

  const candidates: Array<{
    phase: ItemRequestLineSnapshot["phase"];
    label: string;
  }> = [
    {
      phase: "outside_purchase_return_estimate_accepted",
      label: OUTSIDE_PURCHASE_RETURN_ESTIMATE_ACCEPTED_STATUS_LABEL,
    },
    {
      phase: "outside_purchase_return_estimate_ready",
      label: "Return estimate ready",
    },
    {
      phase: "outside_purchase_return_requested",
      label: OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL,
    },
    {
      phase: "outside_purchase_return_cancelled",
      label: "Return request cancelled",
    },
  ];

  let latest: { label: string; at: number } | null = null;
  for (const candidate of candidates) {
    const at = latestOutsidePurchaseSnapshotMs(snapshots, candidate.phase);
    if (at == null) continue;
    if (!latest || at > latest.at) {
      latest = { label: candidate.label, at };
    }
  }

  if (!latest || latest.label === "Return request cancelled") {
    return null;
  }
  if (outsidePurchaseReturnWorkflowSupersededByCheckout(snapshots)) {
    return null;
  }
  return latest.label;
}

export function outsidePurchaseActiveReturnStatusLabel(
  returnRequest: Pick<OutsidePurchaseReturnRequest, "status"> | null | undefined,
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[] | undefined,
  _audience: OutsidePurchaseStatusAudience = "customer",
): string | null {
  if (
    returnRequest &&
    isOutsidePurchaseActiveReturnPhase(returnRequest.status)
  ) {
    if (
      returnRequest.status === "estimate_accepted" &&
      outsidePurchaseReturnWorkflowSupersededByCheckout(snapshots)
    ) {
      return null;
    }
    return outsidePurchaseReturnStatusLabel(returnRequest);
  }

  return outsidePurchaseSnapshotReturnStatusLabel(snapshots);
}

/** Customer/admin label for outside-purchase lines (condition + return workflow). */
export function outsidePurchaseStatusLabelForDisplay(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
  snapshots?: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[],
  audience: OutsidePurchaseStatusAudience = "customer",
): string | null {
  if (!isOutsidePurchaseRequest(request)) {
    return null;
  }

  const returnLabel = outsidePurchaseActiveReturnStatusLabel(
    returnRequest,
    snapshots,
    audience,
  );
  if (returnLabel) {
    return returnLabel;
  }

  if (request.status !== "quoted") {
    return WORKFLOW_STATUS_LABELS[request.status];
  }

  if (request.outsidePurchasePublishedAt === null) {
    return "Unpublished · draft";
  }

  const condition = parseOutsidePurchaseReceivedCondition(
    request.outsidePurchaseReceivedCondition,
  );
  const suffix = promptedSuffix(request);

  switch (condition) {
    case "good":
      return `Payment due${suffix}`;
    case "damaged":
      return `Received: Damaged${suffix}`;
    case "wrong_item":
      return `Received: Wrong item${suffix}`;
    case "missing":
      return isOutsidePurchaseMissingResolved(request) ?
          "Missing item : resolved"
        : `Received: Missing item${suffix}`;
    default:
      return `Payment due${suffix}`;
  }
}

const WORKFLOW_STATUS_LABELS: Record<ItemRequest["status"], string> = {
  pending: "New request",
  quoted: "Quoted",
  approved: "In Cart",
  rejected: "Missing Item",
  withdrawn: "Deleted from cart",
  out_of_stock: "Out of stock",
};

export function itemRequestStatusLabelForDisplayWithReturn(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): string {
  const op = outsidePurchaseStatusLabelForDisplay(request, returnRequest);
  if (op) return op;
  return WORKFLOW_STATUS_LABELS[request.status];
}

/** Damaged, wrong item, or missing — needs return workflow / warning UI. */
export function isOutsidePurchaseProblemReceiptCondition(
  request: OutsidePurchaseDisplayRequest,
): boolean {
  if (!isOutsidePurchaseRequest(request)) return false;
  const condition = parseOutsidePurchaseReceivedCondition(
    request.outsidePurchaseReceivedCondition,
  );
  return (
    condition === "damaged" ||
    condition === "missing" ||
    condition === "wrong_item"
  );
}

/**
 * Quoted outside-purchase line whose item was received as missing. There is
 * nothing to pay for and nothing to return, so customers only get a read-only
 * preview of the product details, received photo, and receipt.
 */
export function isOutsidePurchaseMissingItem(
  request: OutsidePurchaseDisplayRequest,
): boolean {
  if (!isOutsidePurchaseRequest(request) || request.status !== "quoted") {
    return false;
  }
  return (
    parseOutsidePurchaseReceivedCondition(
      request.outsidePurchaseReceivedCondition,
    ) === "missing"
  );
}

export function outsidePurchaseWorkflowBadgeKind(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): StatusBadgeKind {
  const problemReceipt =
    request.status === "quoted" && isOutsidePurchaseProblemReceiptCondition(request);

  if (returnRequest) {
    if (problemReceipt && returnRequest.status !== "paid") {
      return "outsidePurchaseProblemReceipt";
    }
    switch (returnRequest.status) {
      case "submitted":
        return "awaitingPurchase";
      case "estimate_ready":
        return "quoted";
      case "estimate_accepted":
        return "quoted";
      case "paid":
        return "fullyReceived";
      case "cancelled":
        return "deletedFromCart";
      default: {
        const _exhaustive: never = returnRequest.status;
        return _exhaustive;
      }
    }
  }

  if (problemReceipt) {
    return "outsidePurchaseProblemReceipt";
  }

  const condition = parseOutsidePurchaseReceivedCondition(
    request.outsidePurchaseReceivedCondition,
  );
  switch (condition) {
    case "good":
      return "quoted";
    default:
      return "quoted";
  }
}

export function outsidePurchaseAllowsAcceptQuote(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (!isOutsidePurchaseRequest(request) || request.status !== "quoted") {
    return request.status === "quoted";
  }
  if (isOutsidePurchaseProblemReceiptCondition(request)) {
    if (!returnRequest) return true;
    if (returnRequest.status === "cancelled") return true;
    if (returnRequest.status === "estimate_accepted") return true;
    return false;
  }
  return !returnRequest || returnRequest.status === "cancelled";
}

/** Outside-purchase quoted lines: show Preview estimate unless return estimate is ready. */
export function outsidePurchaseShowsPreviewEstimateInTable(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (!isOutsidePurchaseRequest(request) || request.status !== "quoted") {
    return true;
  }
  if (returnRequest?.status === "estimate_ready") {
    return false;
  }
  return true;
}

export function outsidePurchaseShowsReturnToRetailerAction(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (request.status !== "quoted" || !isOutsidePurchaseProblemReceiptCondition(request)) {
    return false;
  }
  return !returnRequest || returnRequest.status === "cancelled";
}

/** Problem-receipt lines with an active return workflow (not cancelled). */
export function outsidePurchaseShowsReturnPreviewAction(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (
    request.status !== "quoted" ||
    !isOutsidePurchaseProblemReceiptCondition(request) ||
    !returnRequest
  ) {
    return false;
  }
  return (
    returnRequest.status !== "cancelled" &&
    returnRequest.status !== "estimate_accepted"
  );
}

/** Standard service estimate preview during return workflow (before cart acceptance). */
export function outsidePurchaseShowsPreviewEstimateInReturnWorkflow(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (!isOutsidePurchaseRequest(request) || request.status !== "quoted") {
    return false;
  }
  if (!returnRequest) return false;
  return returnRequest.status === "estimate_accepted";
}

export function outsidePurchaseShowsCancelReturnAction(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): boolean {
  if (
    request.status !== "quoted" ||
    !isOutsidePurchaseProblemReceiptCondition(request) ||
    !returnRequest
  ) {
    return false;
  }
  return (
    returnRequest.status === "estimate_ready" ||
    returnRequest.status === "estimate_accepted"
  );
}

export function outsidePurchaseConditionSummary(
  request: OutsidePurchaseDisplayRequest,
): string | null {
  const condition = parseOutsidePurchaseReceivedCondition(
    request.outsidePurchaseReceivedCondition,
  );
  if (!condition) return null;
  return warehouseReceiveConditionLabel(condition);
}
