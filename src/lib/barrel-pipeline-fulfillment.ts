import type { OrderItem } from "@/db/schema";

/** Warehouse receipt complete — waiting for staff to assign a container. */
export const BARREL_PIPELINE_AWAITING_ASSIGNMENT =
  "delivery_received_good_awaiting_barrel" as const satisfies OrderItem["fulfillmentStatus"];

/** Packed into a customer container — awaiting outbound shipping. */
export const BARREL_PIPELINE_IN_CONTAINER =
  "in_barrel_awaiting_shipping" as const satisfies OrderItem["fulfillmentStatus"];

/** Outside purchase service fee paid — visible on product-to-barrel before warehouse assign. */
export const BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID =
  "paid_outside_purchase_service_fee" as const satisfies OrderItem["fulfillmentStatus"];

export const BARREL_PIPELINE_FULFILLMENT_STATUSES = [
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_IN_CONTAINER,
] as const satisfies readonly OrderItem["fulfillmentStatus"][];

/** Statuses shown on the customer product-to-barrel table (inbound + packing queue). */
export const PRODUCT_TO_BARREL_FULFILLMENT_STATUSES = [
  ...BARREL_PIPELINE_FULFILLMENT_STATUSES,
  BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID,
] as const satisfies readonly OrderItem["fulfillmentStatus"][];

export type BarrelPipelineFulfillmentStatus =
  (typeof BARREL_PIPELINE_FULFILLMENT_STATUSES)[number];

export function isBarrelPipelineFulfillmentStatus(
  status: OrderItem["fulfillmentStatus"],
): status is BarrelPipelineFulfillmentStatus {
  return (BARREL_PIPELINE_FULFILLMENT_STATUSES as readonly string[]).includes(
    status,
  );
}

export type ProductToBarrelFulfillmentStatus =
  (typeof PRODUCT_TO_BARREL_FULFILLMENT_STATUSES)[number];

export function isProductToBarrelFulfillmentStatus(
  status: OrderItem["fulfillmentStatus"],
): status is ProductToBarrelFulfillmentStatus {
  return (PRODUCT_TO_BARREL_FULFILLMENT_STATUSES as readonly string[]).includes(
    status,
  );
}
