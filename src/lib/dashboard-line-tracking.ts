import type { Order } from "@/db/schema";
import {
  effectiveOrderItemFulfillmentStatus,
  type OrderItemReadCore,
} from "@/lib/order-item-read-compat";

const TRACKING_STATUS_LABELS: Record<string, string> = {
  UNKNOWN: "Unknown",
  PRE_TRANSIT: "Pre-transit",
  TRANSIT: "In transit",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  FAILURE: "Delivery exception",
};

export function formatShippoLiveTrackingStatus(
  status: string | null | undefined,
  details?: string | null,
): string | null {
  const raw = status?.trim() ?? "";
  if (!raw) return details?.trim() || null;
  const label =
    TRACKING_STATUS_LABELS[raw.toUpperCase()] ??
    raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  const extra = details?.trim() ?? "";
  if (extra && extra.toLowerCase() !== label.toLowerCase()) {
    return `${label} — ${extra}`;
  }
  return label;
}

export type OrderHeaderTracking = {
  key: string;
  trackingUrl: string | null;
  retailerCompany: string | null;
  trackingNumber: string | null;
  trackingStatus: string | null;
  trackingStatusDetails: string | null;
  productLabel: string;
};

type OrderTrackingLine = {
  pendingProductReturnRequest: unknown | null;
  hubTrackingStatus: string | null;
  hubTrackingStatusDetails: string | null;
  hubStockUsLine: boolean;
  request: { productName: string | null };
  orderItem: OrderItemReadCore;
  order: Pick<Order, "status">;
};

function trackingIdentityKey(row: OrderTrackingLine): string | null {
  const url = row.orderItem.companyPurchaseTrackingUrl?.trim() || "";
  const number = row.orderItem.companyPurchaseRetailerTrackingNumber?.trim() || "";
  const company = row.orderItem.companyPurchaseRetailerTrackingCompany?.trim() || "";
  const status = row.hubTrackingStatus?.trim() || "";
  if (url) return `url:${url.toLowerCase()}`;
  if (number) return `num:${number.replace(/\s+/g, "").toUpperCase()}`;
  if (company || status) return `meta:${company.toLowerCase()}:${status.toUpperCase()}`;
  return null;
}

/** One tracking control per unique shipment for the Order products header. */
export function collectOrderHeaderTrackings(
  lines: OrderTrackingLine[],
): OrderHeaderTracking[] {
  const grouped = new Map<string, { row: OrderTrackingLine; names: string[]; hubUs: boolean }>();

  for (const row of lines) {
    if (row.pendingProductReturnRequest != null) continue;
    if (!dashboardShowLineTracking(row)) continue;
    const key = trackingIdentityKey(row);
    if (!key) continue;
    const name = row.request.productName?.trim() || "Item";
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.names.includes(name)) existing.names.push(name);
      existing.hubUs = existing.hubUs && row.hubStockUsLine;
      continue;
    }
    grouped.set(key, { row, names: [name], hubUs: row.hubStockUsLine });
  }

  return [...grouped.entries()].map(([key, group]) => {
    const { row, names, hubUs } = group;
    const productLabel =
      names.length > 1 ?
        hubUs ?
          "Warehouse package"
        : names.join(" · ")
      : (names[0] ?? "Shipment");
    return {
      key,
      trackingUrl: row.orderItem.companyPurchaseTrackingUrl?.trim() || null,
      retailerCompany: row.orderItem.companyPurchaseRetailerTrackingCompany?.trim() || null,
      trackingNumber: row.orderItem.companyPurchaseRetailerTrackingNumber?.trim() || null,
      trackingStatus: row.hubTrackingStatus,
      trackingStatusDetails: row.hubTrackingStatusDetails,
      productLabel,
    };
  });
}

export function dashboardShowLineTracking(row: {
  orderItem: OrderItemReadCore;
  order: Pick<Order, "status">;
}): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const oi = row.orderItem;
  const hasTracking = Boolean(
    oi.companyPurchaseTrackingUrl?.trim() ||
      oi.companyPurchaseRetailerTrackingNumber?.trim() ||
      oi.companyPurchaseRetailerTrackingCompany?.trim(),
  );
  if (fulfillment === "company_purchase_pending_delivery") return true;
  if (fulfillment === "delivery_requested_pending_fulfillment") return true;
  if (
    fulfillment === "delivery_received_item_missing" ||
    fulfillment === "delivery_received_item_damaged" ||
    fulfillment === "delivery_received_wrong_item"
  ) {
    return true;
  }
  if (fulfillment === "delivery_received_good_awaiting_barrel") {
    return hasTracking;
  }
  if (fulfillment === "product_return_awaiting_delivery") return true;
  if (fulfillment === "hub_stock_pending_us_shipment") return hasTracking;
  if (fulfillment === "hub_stock_us_in_transit") return true;
  if (fulfillment === "hub_stock_us_delivered") return true;
  if (fulfillment === "hub_stock_return_requested") return hasTracking;
  return false;
}
