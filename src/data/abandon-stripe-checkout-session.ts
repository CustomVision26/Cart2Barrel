import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orders } from "@/db/schema";
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

  const db = getDb();
  const deleted = await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });

  return { ok: true, hadOrderToClear: deleted.length > 0 };
}
