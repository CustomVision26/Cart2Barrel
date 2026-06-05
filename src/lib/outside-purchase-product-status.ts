import type { ItemRequest, OrderItem, OutsidePurchaseReturnRequest } from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import {
  effectiveOrderItemFulfillmentStatus,
  type OrderItemReadCore,
} from "@/lib/order-item-read-compat";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import {
  outsidePurchaseStatusLabelForDisplay,
  outsidePurchaseWorkflowBadgeKind,
  type OutsidePurchaseDisplayRequest,
} from "@/lib/outside-purchase-display";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  adminOrderLineStatusLabel,
  dashboardOrderLineStatusLabel,
} from "@/lib/order-fulfillment-labels";
import { itemRequestStatusLabel } from "@/lib/item-request-status-label";
import {
  itemRequestWorkflowBadgeKind,
  orderItemFulfillmentBadgeKind,
} from "@/lib/status-badge-map";
import type { StatusBadgeKind } from "@/lib/status-badge-kinds";

export type ItemRequestProductStatusAudience = "admin" | "customer";

export type ResolveItemRequestProductStatusOptions = {
  returnRequest?: Pick<OutsidePurchaseReturnRequest, "status"> | null;
  orderContext?: ItemRequestOrderContext | null;
  audience?: ItemRequestProductStatusAudience;
};

export type ItemRequestProductStatusDisplay = {
  label: string;
  badgeKind: StatusBadgeKind;
  title: string;
};

function orderLineStatusLabel(
  fulfillment: OrderItem["fulfillmentStatus"],
  orderItem: OrderItemReadCore,
  audience: ItemRequestProductStatusAudience,
): string {
  const opts = { warehouseReceivedCondition: orderItem.warehouseReceivedCondition };
  return audience === "admin" ?
      adminOrderLineStatusLabel(fulfillment, opts)
    : dashboardOrderLineStatusLabel(fulfillment, opts);
}

function orderContextFulfillmentDisplay(
  request: Pick<
    ItemRequest,
    | "source"
    | "outsidePurchaseReference"
    | "productUrl"
    | "outsidePurchasePaymentPromptedAt"
    | "outsidePurchaseReceivedCondition"
  >,
  orderContext: ItemRequestOrderContext,
  audience: ItemRequestProductStatusAudience,
): ItemRequestProductStatusDisplay {
  const fulfillment = isOutsidePurchaseRequest(request) ?
      effectiveOutsidePurchasePaidFulfillment(
        request,
        orderContext.orderItem,
        orderContext.order,
      )
    : effectiveOrderItemFulfillmentStatus(
        orderContext.orderItem,
        orderContext.order,
      );
  const label = orderLineStatusLabel(
    fulfillment,
    orderContext.orderItem,
    audience,
  );
  return {
    label,
    badgeKind: orderItemFulfillmentBadgeKind(
      orderContext.orderItem,
      orderContext.order,
      { fulfillmentOverride: fulfillment },
    ),
    title: label,
  };
}

/**
 * Single source of truth for outside-purchase product status in admin and customer UIs.
 * When the line is on an order, fulfillment status wins over stale cart/return workflow labels.
 */
export function resolveOutsidePurchaseProductStatusDisplay(
  request: OutsidePurchaseDisplayRequest,
  options?: ResolveItemRequestProductStatusOptions,
): ItemRequestProductStatusDisplay | null {
  if (!isOutsidePurchaseRequest(request)) {
    return null;
  }

  const returnRequest = options?.returnRequest ?? null;
  const orderContext = options?.orderContext ?? null;
  const audience = options?.audience ?? "admin";

  if (orderContext) {
    return orderContextFulfillmentDisplay(request, orderContext, audience);
  }

  return {
    label:
      outsidePurchaseStatusLabelForDisplay(request, returnRequest) ??
      request.status,
    badgeKind: outsidePurchaseWorkflowBadgeKind(request, returnRequest),
    title: request.status,
  };
}

export function resolveItemRequestProductStatusDisplay(
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
  options?: ResolveItemRequestProductStatusOptions,
): ItemRequestProductStatusDisplay {
  const op = resolveOutsidePurchaseProductStatusDisplay(request, options);
  if (op) {
    return op;
  }

  const orderContext = options?.orderContext ?? null;
  const audience = options?.audience ?? "admin";
  if (orderContext) {
    return orderContextFulfillmentDisplay(request, orderContext, audience);
  }

  return {
    label: itemRequestStatusLabel(request.status),
    badgeKind: itemRequestWorkflowBadgeKind(request.status),
    title: request.status,
  };
}
