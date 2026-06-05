import type { ItemRequest, Order, OutsidePurchaseReturnRequest } from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import {
  resolveItemRequestProductStatusDisplay,
  resolveOutsidePurchaseProductStatusDisplay,
  type ItemRequestProductStatusAudience,
  type ResolveItemRequestProductStatusOptions,
} from "@/lib/outside-purchase-product-status";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";

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

export type ItemRequestStatusDisplayOptions = ResolveItemRequestProductStatusOptions;

/** Customer/admin UI label; outside-purchase lines use order fulfillment when on an order. */
export function itemRequestStatusLabelForDisplay(
  request: Pick<
    ItemRequest,
    | "status"
    | "source"
    | "outsidePurchaseReference"
    | "productUrl"
    | "outsidePurchasePaymentPromptedAt"
    | "outsidePurchaseReceivedCondition"
  > & {
    outsidePurchaseMissingResolvedAt?: ItemRequest["outsidePurchaseMissingResolvedAt"];
  },
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
  orderContext?: ItemRequestOrderContext | null,
  audience?: ItemRequestProductStatusAudience,
): string {
  return resolveItemRequestProductStatusDisplay(request, {
    returnRequest,
    orderContext,
    audience,
  }).label;
}

export function itemRequestStatusBadgeKindForDisplay(
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
  orderContext?: ItemRequestOrderContext | null,
  audience?: ItemRequestProductStatusAudience,
): StatusBadgeKind {
  return resolveItemRequestProductStatusDisplay(request, {
    returnRequest,
    orderContext,
    audience,
  }).badgeKind;
}

/**
 * Admin tables: `approved` still means "accepted quote" in the DB. Customer cart only shows
 * approved rows that are not on an order — show order state when `orderStatus` is set.
 */
export function adminItemRequestStatusDisplay(
  status: ItemRequest["status"],
  orderStatus: Order["status"] | null,
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

/** @deprecated Prefer itemRequestStatusBadgeKindForDisplay with order context. */
export function outsidePurchaseWorkflowBadgeKindForDisplay(
  request: Parameters<typeof itemRequestStatusLabelForDisplay>[0],
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null,
  orderContext?: ItemRequestOrderContext | null,
): StatusBadgeKind {
  if (isOutsidePurchaseRequest(request)) {
    return (
      resolveOutsidePurchaseProductStatusDisplay(request, {
        returnRequest,
        orderContext,
      })?.badgeKind ?? "quoted"
    );
  }
  return itemRequestStatusBadgeKindForDisplay(
    request,
    returnRequest,
    orderContext,
  );
}
