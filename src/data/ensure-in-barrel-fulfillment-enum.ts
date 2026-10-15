import "server-only";

import { sql } from "drizzle-orm";

import {
  markSchemaEnsureFailed,
  markSchemaEnsureReady,
  schemaEnsureFastPath,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

const ENSURE_KEY = "in-barrel-awaiting-shipping-enum";

let enumEnsureAttempted = false;
let enumValueAvailable = false;

/**
 * Adds `in_barrel_awaiting_shipping` to Postgres when missing (idempotent).
 * Required before updates or filters using that fulfillment status.
 */
export async function ensureInBarrelAwaitingShippingEnumValue(): Promise<boolean> {
  if (schemaEnsureFastPath(ENSURE_KEY)) return true;
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
    markSchemaEnsureReady(ENSURE_KEY);
    return true;
  } catch (e) {
    const low = String(e).toLowerCase();
    if (low.includes("already exists")) {
      enumValueAvailable = true;
      markSchemaEnsureReady(ENSURE_KEY);
      return true;
    }
    if (isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
      enumValueAvailable = false;
      markSchemaEnsureFailed(ENSURE_KEY);
      return false;
    }
    markSchemaEnsureFailed(ENSURE_KEY);
    throw e;
  }
}
