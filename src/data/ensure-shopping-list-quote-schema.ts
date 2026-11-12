import "server-only";

import { sql } from "drizzle-orm";

import {
  isSchemaEnsureReady,
  markSchemaEnsureFailed,
  markSchemaEnsureReady,
} from "@/data/schema-ensure-gate";
import { getDb } from "@/db";

const ENSURE_KEY = "shopping-list-quotes-v4";

let inFlight: Promise<boolean> | null = null;

/** Creates shopping-list quote tables when Drizzle schema is ahead of Neon. */
export async function ensureShoppingListQuoteSchema(): Promise<boolean> {
  if (isSchemaEnsureReady(ENSURE_KEY)) return true;
  if (inFlight) return inFlight;
  inFlight = ensureShoppingListQuoteSchemaInner().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function ensureShoppingListQuoteSchemaInner(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shopping_list_quotes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clerk_user_id" text NOT NULL REFERENCES "profiles"("clerk_user_id") ON DELETE cascade,
        "source_image_url" text NOT NULL,
        "status" text DEFAULT 'draft' NOT NULL,
        "batch_quote_session_id" uuid REFERENCES "batch_quote_sessions"("id") ON DELETE set null,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shopping_list_quote_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "shopping_list_quote_id" uuid NOT NULL REFERENCES "shopping_list_quotes"("id") ON DELETE cascade,
        "sort_index" integer DEFAULT 0 NOT NULL,
        "product_name" text,
        "quantity" integer DEFAULT 1 NOT NULL,
        "product_size" text,
        "product_color" text,
        "note" text,
        "product_image_url" text,
        "item_request_id" uuid REFERENCES "item_requests"("id") ON DELETE set null,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "shopping_list_quotes_clerk_user_id_created_at_idx"
      ON "shopping_list_quotes" ("clerk_user_id", "created_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "shopping_list_quotes_status_idx"
      ON "shopping_list_quotes" ("status")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "shopping_list_quotes_batch_session_idx"
      ON "shopping_list_quotes" ("batch_quote_session_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "shopping_list_quote_lines_list_id_idx"
      ON "shopping_list_quote_lines" ("shopping_list_quote_id")
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
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "merchandise_budget_cents" integer
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "builder_snapshot" jsonb
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quotes"
      ADD COLUMN IF NOT EXISTS "staff_draft" jsonb
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "retailer" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "seller_name" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "retailer_product_url" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "pack_size" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "observed_price_cents" integer
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "currency" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "availability" text
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "price_retrieved_at" timestamp with time zone
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "needs_staff_review" boolean DEFAULT false NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "shopping_list_quote_lines"
      ADD COLUMN IF NOT EXISTS "retailer_delivery_cents" integer
    `);
    markSchemaEnsureReady(ENSURE_KEY);
    return true;
  } catch (error) {
    markSchemaEnsureFailed(ENSURE_KEY);
    console.warn(
      "[Amani Cart2Barrel] shopping_list_quotes schema ensure failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
