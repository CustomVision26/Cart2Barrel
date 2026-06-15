export const COMPANY_PURCHASE_INBOUND_SHIPMENT = "shipment" as const;
export const COMPANY_PURCHASE_INBOUND_STORE_PICKUP = "store_pickup" as const;

export const COMPANY_PURCHASE_INBOUND_METHODS = [
  COMPANY_PURCHASE_INBOUND_SHIPMENT,
  COMPANY_PURCHASE_INBOUND_STORE_PICKUP,
] as const;

export type CompanyPurchaseInboundMethod =
  (typeof COMPANY_PURCHASE_INBOUND_METHODS)[number];

export function isCompanyPurchaseInboundMethod(
  value: string | null | undefined,
): value is CompanyPurchaseInboundMethod {
  return (
    value === COMPANY_PURCHASE_INBOUND_SHIPMENT ||
    value === COMPANY_PURCHASE_INBOUND_STORE_PICKUP
  );
}

export function isStorePickupInbound(
  method: string | null | undefined,
): boolean {
  return method === COMPANY_PURCHASE_INBOUND_STORE_PICKUP;
}

/** Display label when a store-pickup line is in the barrel packing pipeline. */
export const STORE_PICKUP_IN_BARREL_AWAITING_SHIPPING_LABEL =
  "In Barrel: awaiting shipping: (Pickup)" as const;

export function inBarrelAwaitingShippingStatusLabel(
  inboundMethod: string | null | undefined,
): string {
  return isStorePickupInbound(inboundMethod) ?
      STORE_PICKUP_IN_BARREL_AWAITING_SHIPPING_LABEL
    : "In Barrel: awaiting shipping";
}
