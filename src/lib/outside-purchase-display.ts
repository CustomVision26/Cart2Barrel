import type { ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";
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
>;

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

export function outsidePurchaseReturnStatusLabel(
  row: Pick<OutsidePurchaseReturnRequest, "status">,
): string | null {
  switch (row.status) {
    case "submitted":
      return "Return requested · awaiting estimate";
    case "estimate_ready":
      return "Return estimate ready";
    case "estimate_accepted":
      return "Payment due · return to retailer prompted";
    case "paid":
      return "Return paid · drop off at carrier";
    case "cancelled":
      return "Return request cancelled";
    default:
      return null;
  }
}

/** Customer/admin label for outside-purchase lines (condition + return workflow). */
export function outsidePurchaseStatusLabelForDisplay(
  request: OutsidePurchaseDisplayRequest,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): string | null {
  if (!isOutsidePurchaseRequest(request)) {
    return null;
  }

  const returnLabel = returnRequest
    ? outsidePurchaseReturnStatusLabel(returnRequest)
    : null;
  if (returnLabel) {
    return returnLabel;
  }

  if (request.status !== "quoted") {
    return WORKFLOW_STATUS_LABELS[request.status];
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
      return `Received: Missing item${suffix}`;
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

/** Outside-purchase quoted lines: show standard Preview estimate in the table (not problem receipts). */
export function outsidePurchaseShowsPreviewEstimateInTable(
  request: OutsidePurchaseDisplayRequest,
): boolean {
  if (!isOutsidePurchaseRequest(request) || request.status !== "quoted") {
    return true;
  }
  return !isOutsidePurchaseProblemReceiptCondition(request);
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
  return (
    returnRequest.status === "estimate_ready" ||
    returnRequest.status === "estimate_accepted"
  );
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
