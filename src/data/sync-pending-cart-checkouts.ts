import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orders } from "@/db/schema";
import {
  getStripeServer,
  isStripeCartCheckoutConfigured,
} from "@/lib/stripe-server";

export type PendingCartCheckoutSync = {
  releasedCount: number;
  openCheckouts: { sessionId: string }[];
};

const LEGACY_PENDING_UNLINKED_ORDER_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Clears stale `orders`+`order_items` reservations from abandoned/failed checkouts so
 * `item_requests` reappear in the cart. Best-effort when Stripe is unavailable.
 */
export async function syncPendingCartCheckoutsBeforeCartPage(
  clerkUserId: string,
): Promise<PendingCartCheckoutSync> {
  const db = getDb();
  let releasedCount = 0;
  const openCheckouts: { sessionId: string }[] = [];
  const openSeen = new Set<string>();

  const pending = await db
    .select()
    .from(orders)
    .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "pending")));

  const stripeReady = isStripeCartCheckoutConfigured();
  let stripe: ReturnType<typeof getStripeServer> | null = null;
  if (stripeReady) {
    try {
      stripe = getStripeServer();
    } catch {
      stripe = null;
    }
  }

  const now = Date.now();

  for (const row of pending) {
    const sessionId = row.stripeCheckoutSessionId?.trim() ?? "";

    if (!sessionId) {
      const createdMs = Date.parse(row.createdAt);
      if (
        Number.isFinite(createdMs) &&
        now - createdMs > LEGACY_PENDING_UNLINKED_ORDER_MAX_AGE_MS
      ) {
        const deleted = await db
          .delete(orders)
          .where(and(eq(orders.id, row.id), eq(orders.status, "pending")))
          .returning({ id: orders.id });
        if (deleted.length > 0) releasedCount++;
      }
      continue;
    }

    if (!stripe) {
      continue;
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "expired") {
        const deleted = await db
          .delete(orders)
          .where(and(eq(orders.id, row.id), eq(orders.status, "pending")))
          .returning({ id: orders.id });
        if (deleted.length > 0) releasedCount++;
        continue;
      }
      if (session.status === "open" && !openSeen.has(sessionId)) {
        openSeen.add(sessionId);
        openCheckouts.push({ sessionId });
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "resource_missing") {
        const deleted = await db
          .delete(orders)
          .where(and(eq(orders.id, row.id), eq(orders.status, "pending")))
          .returning({ id: orders.id });
        if (deleted.length > 0) releasedCount++;
      }
    }
  }

  return { releasedCount, openCheckouts };
}
