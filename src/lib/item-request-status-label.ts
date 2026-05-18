import type { ItemRequest, Order, OutsidePurchaseReturnRequest } from "@/db/schema";
import { itemRequestStatusLabelForDisplayWithReturn } from "@/lib/outside-purchase-display";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";

const LABELS: Record<ItemRequest["status"], string> = {
  pending: "New request",
  quoted: "Quoted",
  approved: "In Cart",
  rejected: "Missing Item",
  withdrawn: "Deleted from cart",
  out_of_stock: "Out of stock",
};

export function itemRequestStatusLabel(status: ItemRequest["status"]): string {
  return LABELS[status];
}

/** Customer/admin UI label; outside-purchase lines use condition-aware labels. */
export function itemRequestStatusLabelForDisplay(
  request: Pick<
    ItemRequest,
    | "status"
    | "source"
    | "outsidePurchaseReference"
    | "productUrl"
    | "outsidePurchasePaymentPromptedAt"
    | "outsidePurchaseReceivedCondition"
  >,
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
): string {
  if (isOutsidePurchaseRequest(request)) {
    return itemRequestStatusLabelForDisplayWithReturn(request, returnRequest);
  }
  return itemRequestStatusLabel(request.status);
}

/**
 * Admin tables: `approved` still means "accepted quote" in the DB. Customer cart only shows
 * approved rows that are not on an order — show order state when `orderStatus` is set.
 */
export function adminItemRequestStatusDisplay(
  status: ItemRequest["status"],
  orderStatus: Order["status"] | null
): string {
  if (status !== "approved") {
    return LABELS[status];
  }
  if (!orderStatus) {
    return LABELS.approved;
  }
  const orderLabels: Record<Order["status"], string> = {
    pending: "Awaiting Purchase",
    paid: "Awaiting Purchase",
    purchasing: "Purchasing",
    completed: "Fully Received",
  };
  return orderLabels[orderStatus];
}
