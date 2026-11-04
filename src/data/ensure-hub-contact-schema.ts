import "server-only";

import { sql } from "drizzle-orm";

import {
  isSchemaEnsureReady,
  markSchemaEnsureFailed,
  markSchemaEnsureReady,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";

/** New key so a prior skip-in-dev "ready" flag cannot skip CREATE. */
const ENSURE_KEY = "hub-contact-table";

let inFlight: Promise<boolean> | null = null;

/**
 * Creates `hub_contact_settings` when Drizzle schema is ahead of Neon.
 * Always runs CREATE IF NOT EXISTS (one cheap statement) — this table is
 * read on every public layout, so skipping it in local dev crashes the footer.
 */
export async function ensureHubContactSettingsSchema(): Promise<boolean> {
  if (isSchemaEnsureReady(ENSURE_KEY)) return true;
  if (inFlight) return inFlight;
  inFlight = ensureHubContactSettingsSchemaInner().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function ensureHubContactSettingsSchemaInner(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "hub_contact_settings" (
        "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
        "support_email" text,
        "support_phone" text,
        "whatsapp_number" text,
        "instagram_url" text,
        "facebook_url" text,
        "x_url" text,
        "tiktok_url" text,
        "public_intro" text,
        "business_hours" text,
        "business_address" text,
        "updated_by_clerk_user_id" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE "hub_contact_settings"
      ADD COLUMN IF NOT EXISTS "business_address" text
    `);
    markSchemaEnsureReady(ENSURE_KEY);
    return true;
  } catch (error) {
    markSchemaEnsureFailed(ENSURE_KEY);
    console.warn(
      "[Amani Cart2Barrel] hub_contact_settings schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
