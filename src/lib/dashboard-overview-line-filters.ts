import type { OrderItem } from "@/db/schema";

/** Paid lines in transit to the warehouse (company purchase recorded). */
export const DASHBOARD_AWAITING_INBOUND_FULFILLMENTS = [
  "company_purchase_pending_delivery",
  "delivery_requested_pending_fulfillment",
] as const satisfies readonly OrderItem["fulfillmentStatus"][];

/** Problem warehouse receipts that may need customer or staff follow-up. */
export const DASHBOARD_RECEIPT_CORRECTION_FULFILLMENTS = [
  "delivery_received_item_missing",
  "delivery_received_item_damaged",
  "delivery_received_wrong_item",
] as const satisfies readonly OrderItem["fulfillmentStatus"][];
