import "server-only";

import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, orderItems, orders } from "@/db/schema";
import { ensurePaidOutsidePurchaseFulfillmentEnums } from "@/data/ensure-paid-outside-purchase-fulfillment-enum";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

const OUTSIDE_PURCHASE_URL_PREFIX = "https://intake.cart2barrel.invalid/outside-purchase/%";

/**
 * Idempotently sets paid outside-purchase order lines to `paid_outside_purchase_service_fee`
 * when checkout left them on the generic post-paid status.
 */
export async function backfillOutsidePurchasePaidServiceFeeFulfillment(): Promise<void> {
  const enumReady = await ensurePaidOutsidePurchaseFulfillmentEnums();
  if (!enumReady) {
    return;
  }

  const db = getDb();
  const candidates = await db
    .select({ orderItemId: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(
      and(
        eq(orders.status, "paid"),
        inArray(orderItems.fulfillmentStatus, [
          "paid_pending_company_purchase",
          "pending_payment",
        ]),
        or(
          eq(itemRequests.source, "outside_purchase"),
          isNotNull(itemRequests.outsidePurchaseReference),
          sql`${itemRequests.productUrl} like ${OUTSIDE_PURCHASE_URL_PREFIX}`,
        )!,
      )!,
    );

  const ids = candidates.map((r) => r.orderItemId);
  if (ids.length === 0) {
    return;
  }

  try {
    await db
      .update(orderItems)
      .set({ fulfillmentStatus: BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID })
      .where(inArray(orderItems.id, ids));
  } catch (e) {
    if (!isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
      throw e;
    }
  }
}
