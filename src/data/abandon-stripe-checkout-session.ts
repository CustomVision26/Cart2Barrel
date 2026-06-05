import { deletePendingOrderAndRestoreContainerCart } from "@/data/delete-pending-order-with-container-restore";
import { parseOutboundChargeIdsFromMetadata } from "@/data/fulfill-outbound-shipping-checkout";
import { getStripeServer } from "@/lib/stripe-server";

export type AbandonPendingCheckoutResult =
  | { ok: true; hadOrderToClear: boolean }
  | { ok: false; reason: "retrieve_failed" | "wrong_user" };

/**
 * Drops the pending `orders` row created for a Stripe Checkout session (cascades
 * `order_items`). Validates session ownership via `client_reference_id`.
 */
export async function abandonPendingOrderFromStripeCheckoutSession(
  clerkUserId: string,
  checkoutSessionId: string,
): Promise<AbandonPendingCheckoutResult> {
  const stripe = getStripeServer();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  } catch {
    return { ok: false, reason: "retrieve_failed" };
  }

  if (session.client_reference_id !== clerkUserId) {
    return { ok: false, reason: "wrong_user" };
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return { ok: true, hadOrderToClear: false };
  }

  const outboundChargeIds = parseOutboundChargeIdsFromMetadata(
    session.metadata?.outboundChargeIds,
  );

  const cleared = await deletePendingOrderAndRestoreContainerCart(
    orderId,
    clerkUserId,
    outboundChargeIds,
  );

  return { ok: true, hadOrderToClear: cleared };
}
