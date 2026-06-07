import type { ItemRequest, OrderItem, OutsidePurchaseReturnRequest, ItemRequestLineSnapshot } from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import {
  effectiveOrderItemFulfillmentStatus,
  type OrderItemReadCore,
} from "@/lib/order-item-read-compat";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import {
  outsidePurchaseActiveReturnStatusLabel,
  outsidePurchaseReturnStatusSuppressedAfterReinstate,
  outsidePurchaseReturnWorkflowSupersededByCheckout,
  outsidePurchaseStatusLabelForDisplay,
  outsidePurchaseWorkflowBadgeKind,
  isOutsidePurchaseActiveReturnPhase,
  OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL,
  type OutsidePurchaseDisplayRequest,
} from "@/lib/outside-purchase-display";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";
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
  snapshots?: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[];
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
    const fulfillment = effectiveOutsidePurchasePaidFulfillment(
      request,
      orderContext.orderItem,
      orderContext.order,
    );
    if (fulfillment === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID) {
      return orderContextFulfillmentDisplay(request, orderContext, audience);
    }
  }

  if (outsidePurchaseReturnWorkflowSupersededByCheckout(options?.snapshots)) {
    return {
      label: PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL,
      badgeKind: "fullyReceived",
      title: PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL,
    };
  }

  const activeReturnLabel = outsidePurchaseActiveReturnStatusLabel(
    returnRequest,
    options?.snapshots,
    audience,
  );
  if (activeReturnLabel) {
    const returnForBadge =
      returnRequest && isOutsidePurchaseActiveReturnPhase(returnRequest.status) ?
        returnRequest
      : activeReturnLabel === "Return estimate ready" ?
        ({ status: "estimate_ready" } as const)
      : activeReturnLabel === OUTSIDE_PURCHASE_RETURN_REQUESTED_STATUS_LABEL ?
        ({ status: "submitted" } as const)
      : activeReturnLabel === "Payment due · return to retailer prompted" ?
        ({ status: "estimate_accepted" } as const)
      : null;
    return {
      label: activeReturnLabel,
      badgeKind: outsidePurchaseWorkflowBadgeKind(request, returnForBadge),
      title: activeReturnLabel,
    };
  }

  if (
    audience === "admin" &&
    request.status === "quoted" &&
    request.outsidePurchasePublishedAt === null
  ) {
    return {
      label: "Unpublished · draft",
      badgeKind: "awaitingPurchase",
      title: "Not visible to customer until published",
    };
  }

  if (orderContext) {
    return orderContextFulfillmentDisplay(request, orderContext, audience);
  }

  return {
    label:
      outsidePurchaseStatusLabelForDisplay(
        request,
        returnRequest,
        options?.snapshots,
        audience,
      ) ?? request.status,
    badgeKind: outsidePurchaseWorkflowBadgeKind(
      request,
      outsidePurchaseReturnStatusSuppressedAfterReinstate(
        returnRequest,
        options?.snapshots,
        audience,
      ) ?
        null
      : returnRequest,
    ),
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
    | "outsidePurchasePublishedAt"
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
