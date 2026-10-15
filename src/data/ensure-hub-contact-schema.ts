import "server-only";

import { sql } from "drizzle-orm";

import {
  markSchemaEnsureReady,
  schemaEnsureFastPath,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";

const ENSURE_KEY = "hub-contact";

let attempted = false;

/** Adds hub-contact columns when Drizzle schema is ahead of Neon (idempotent). */
export async function ensureHubContactSettingsSchema(): Promise<void> {
  if (schemaEnsureFastPath(ENSURE_KEY)) return;
  if (attempted) return;
  attempted = true;

  const db = getDb();
  await db.execute(sql`
    ALTER TABLE "hub_contact_settings"
    ADD COLUMN IF NOT EXISTS "business_address" text
  `);
  markSchemaEnsureReady(ENSURE_KEY);
}
