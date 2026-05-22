/**
 * Idempotent fix for spotlight_category_products (table + price_usd_cents column).
 * Run: npm run db:ensure-spotlight
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS "spotlight_category_products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "category_slug" text NOT NULL,
    "product_url" text NOT NULL,
    "image_url" text,
    "price_usd_cents" integer,
    "label" text,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "price_usd_cents" integer
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "product_size" text
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "product_color" text
`;

await sql`
  CREATE INDEX IF NOT EXISTS "spotlight_category_products_slug_active_sort_idx"
  ON "spotlight_category_products" USING btree ("category_slug", "is_active", "sort_index")
`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'spotlight_category_products'
  ORDER BY ordinal_position
`;
console.log(
  "spotlight_category_products ready:",
  cols.map((c) => c.column_name).join(", "),
);

await sql`
  CREATE TABLE IF NOT EXISTS "spotlight_product_variants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_product_id" uuid NOT NULL,
    "product_url" text,
    "image_url" text,
    "price_usd_cents" integer,
    "product_size" text,
    "product_color" text,
    "pack_label" text,
    "label" text,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "spotlight_product_variants"
    ADD CONSTRAINT "spotlight_product_variants_parent_product_id_fk"
    FOREIGN KEY ("parent_product_id")
    REFERENCES "spotlight_category_products"("id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "spotlight_product_variants_parent_active_sort_idx"
  ON "spotlight_product_variants" USING btree ("parent_product_id", "is_active", "sort_index")
`;

const variantCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'spotlight_product_variants'
  ORDER BY ordinal_position
`;
console.log(
  "spotlight_product_variants ready:",
  variantCols.map((c) => c.column_name).join(", "),
);
