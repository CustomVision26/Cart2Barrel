import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let attempted = false;

/** Adds special-feature columns when Drizzle schema is ahead of Neon (idempotent). */
export async function ensureSpecialFeatureOfferSchema(): Promise<void> {
  if (attempted) return;
  attempted = true;

  const db = getDb();
  await db.execute(sql`
    ALTER TABLE "special_feature_offers"
    ADD COLUMN IF NOT EXISTS "suitcase_slot_capacity" integer
  `);
}
