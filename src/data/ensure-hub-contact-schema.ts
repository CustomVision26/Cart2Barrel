import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let attempted = false;

/** Adds hub-contact columns when Drizzle schema is ahead of Neon (idempotent). */
export async function ensureHubContactSettingsSchema(): Promise<void> {
  if (attempted) return;
  attempted = true;

  const db = getDb();
  await db.execute(sql`
    ALTER TABLE "hub_contact_settings"
    ADD COLUMN IF NOT EXISTS "business_address" text
  `);
}
