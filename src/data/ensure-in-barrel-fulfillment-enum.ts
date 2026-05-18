import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

let enumEnsureAttempted = false;
let enumValueAvailable = false;

/**
 * Adds `in_barrel_awaiting_shipping` to Postgres when missing (idempotent).
 * Required before updates or filters using that fulfillment status.
 */
export async function ensureInBarrelAwaitingShippingEnumValue(): Promise<boolean> {
  if (enumEnsureAttempted) {
    return enumValueAvailable;
  }
  enumEnsureAttempted = true;

  const db = getDb();
  try {
    await db.execute(sql`
      ALTER TYPE "public"."order_item_fulfillment_status"
      ADD VALUE IF NOT EXISTS 'in_barrel_awaiting_shipping'
    `);
    enumValueAvailable = true;
    return true;
  } catch (e) {
    const low = String(e).toLowerCase();
    if (low.includes("already exists")) {
      enumValueAvailable = true;
      return true;
    }
    if (isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
      enumValueAvailable = false;
      return false;
    }
    throw e;
  }
}
