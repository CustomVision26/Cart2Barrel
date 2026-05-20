import "server-only";

import {
  clearOutboundShippingCartForCharges,
  markOutboundShippingChargesPaid,
} from "@/data/barrel-outbound-shipping-charges";

export function parseOutboundChargeIdsFromMetadata(
  raw: string | undefined,
): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.length > 0);
}

/** After a cart checkout that included outbound shipping charge line items. */
export async function fulfillOutboundShippingChargesFromCheckout(
  clerkUserId: string,
  chargeIds: string[],
  payment: { orderId: string; stripePaymentIntentId: string },
): Promise<void> {
  if (chargeIds.length === 0) return;
  await markOutboundShippingChargesPaid(clerkUserId, chargeIds, payment);
  await clearOutboundShippingCartForCharges(clerkUserId, chargeIds);
}
