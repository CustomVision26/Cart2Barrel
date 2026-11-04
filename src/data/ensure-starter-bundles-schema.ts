import "server-only";

import { sql } from "drizzle-orm";

import {
  isSchemaEnsureReady,
  markSchemaEnsureFailed,
  markSchemaEnsureReady,
  schemaEnsureFastPath,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";

const ENSURE_KEY = "starter-bundles";
const MARQUEE_ENSURE_KEY = "starter-bundle-marquee-settings";

let inFlight: Promise<boolean> | null = null;

/** Creates starter-bundle tables and shopping-list source columns when Neon is behind. */
export async function ensureStarterBundlesSchema(): Promise<boolean> {
  if (isSchemaEnsureReady(ENSURE_KEY)) return true;
  if (schemaEnsureFastPath(ENSURE_KEY)) return true;
  if (inFlight) return inFlight;
  inFlight = ensureStarterBundlesSchemaInner().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function ensureStarterBundlesSchemaInner(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "starter_bundles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "image_url" text,
        "barrel_size" text,
        "barrel_fill_level" text,
        "status" text DEFAULT 'draft' NOT NULL,
        "created_by_clerk_user_id" text NOT NULL,
        "published_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "starter_bundle_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "starter_bundle_id" uuid NOT NULL REFERENCES "starter_bundles"("id") ON DELETE cascade,
        "sort_index" integer DEFAULT 0 NOT NULL,
        "product_name" text NOT NULL,
        "quantity" integer DEFAULT 1 NOT NULL,
        "estimated_unit_price_cents" integer NOT NULL,
        "product_size" text,
        "product_color" text,
        "retailer_url" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "starter_bundles_status_updated_at_idx"
      ON "starter_bundles" ("status", "updated_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "starter_bundle_items_bundle_id_sort_idx"
      ON "starter_bundle_items" ("starter_bundle_id", "sort_index")
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ALTER COLUMN "source_image_url" DROP NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "source_kind" text DEFAULT 'photo' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "starter_bundle_id" uuid
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "starter_bundle_snapshot" jsonb
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "customer_note" text
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "shopping_list_quotes_source_kind_idx"
      ON "shopping_list_quotes" ("source_kind")
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "starter_bundle_marquee_settings" (
        "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
        "published" boolean DEFAULT false NOT NULL,
        "updated_by_clerk_user_id" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    markSchemaEnsureReady(ENSURE_KEY);
    markSchemaEnsureReady(MARQUEE_ENSURE_KEY);
    return true;
  } catch (error) {
    markSchemaEnsureFailed(ENSURE_KEY);
    console.warn(
      "[Amani Cart2Barrel] starter_bundles schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

/** Creates the Home marquee published flag table when Neon is behind. */
export async function ensureStarterBundleMarqueeSettingsSchema(): Promise<boolean> {
  if (isSchemaEnsureReady(MARQUEE_ENSURE_KEY)) return true;
  if (schemaEnsureFastPath(MARQUEE_ENSURE_KEY)) return true;
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "starter_bundle_marquee_settings" (
        "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
        "published" boolean DEFAULT false NOT NULL,
        "updated_by_clerk_user_id" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    markSchemaEnsureReady(MARQUEE_ENSURE_KEY);
    return true;
  } catch (error) {
    markSchemaEnsureFailed(MARQUEE_ENSURE_KEY);
    console.warn(
      "[Amani Cart2Barrel] starter_bundle_marquee_settings schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
