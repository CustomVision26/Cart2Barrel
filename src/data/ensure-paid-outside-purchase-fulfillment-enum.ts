import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

let fulfillmentEnumAttempted = false;
let fulfillmentEnumAvailable = false;
let snapshotPhaseAttempted = false;
let snapshotPhaseAvailable = false;

export async function ensurePaidOutsidePurchaseFulfillmentEnums(): Promise<boolean> {
  const db = getDb();

  if (!fulfillmentEnumAttempted) {
    fulfillmentEnumAttempted = true;
    try {
      await db.execute(sql`
        ALTER TYPE "public"."order_item_fulfillment_status"
        ADD VALUE IF NOT EXISTS 'paid_outside_purchase_service_fee'
      `);
      fulfillmentEnumAvailable = true;
    } catch (e) {
      const low = String(e).toLowerCase();
      if (low.includes("already exists")) {
        fulfillmentEnumAvailable = true;
      } else if (isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
        fulfillmentEnumAvailable = false;
      } else {
        throw e;
      }
    }
  }

  if (!snapshotPhaseAttempted) {
    snapshotPhaseAttempted = true;
    try {
      await db.execute(sql`
        ALTER TYPE "public"."item_request_line_snapshot_phase"
        ADD VALUE IF NOT EXISTS 'outside_purchase_checkout_paid'
      `);
      snapshotPhaseAvailable = true;
    } catch (e) {
      const low = String(e).toLowerCase();
      if (low.includes("already exists")) {
        snapshotPhaseAvailable = true;
      } else {
        snapshotPhaseAvailable = false;
      }
    }
  }

  return fulfillmentEnumAvailable && snapshotPhaseAvailable;
}
