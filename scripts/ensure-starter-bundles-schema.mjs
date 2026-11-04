/**
 * Idempotent Starter Bundles tables + shopping_list_quotes source columns.
 * Run: node scripts/ensure-starter-bundles-schema.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
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
`;

await sql`
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
`;

await sql`
  CREATE INDEX IF NOT EXISTS "starter_bundles_status_updated_at_idx"
  ON "starter_bundles" ("status", "updated_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "starter_bundle_items_bundle_id_sort_idx"
  ON "starter_bundle_items" ("starter_bundle_id", "sort_index")
`;

await sql`
  ALTER TABLE "shopping_list_quotes"
  ALTER COLUMN "source_image_url" DROP NOT NULL
`;

await sql`
  ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "source_kind" text DEFAULT 'photo' NOT NULL
`;

await sql`
  ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "starter_bundle_id" uuid
`;

await sql`
  ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "starter_bundle_snapshot" jsonb
`;

await sql`
  ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "customer_note" text
`;

await sql`
  CREATE INDEX IF NOT EXISTS "shopping_list_quotes_source_kind_idx"
  ON "shopping_list_quotes" ("source_kind")
`;

await sql`
  CREATE TABLE IF NOT EXISTS "starter_bundle_marquee_settings" (
    "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
    "published" boolean DEFAULT false NOT NULL,
    "updated_by_clerk_user_id" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'starter_bundles',
      'starter_bundle_items',
      'starter_bundle_marquee_settings'
    )
  ORDER BY table_name
`;
const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'shopping_list_quotes'
    AND column_name IN (
      'source_kind',
      'starter_bundle_id',
      'starter_bundle_snapshot',
      'customer_note',
      'source_image_url'
    )
  ORDER BY column_name
`;
console.log(
  "starter bundles ready:",
  tables.map((row) => row.table_name).join(", "),
);
console.log(
  "shopping_list_quotes columns:",
  cols.map((row) => row.column_name).join(", "),
);
