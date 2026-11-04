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
);

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
);

CREATE INDEX IF NOT EXISTS "starter_bundles_status_updated_at_idx"
  ON "starter_bundles" ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "starter_bundle_items_bundle_id_sort_idx"
  ON "starter_bundle_items" ("starter_bundle_id", "sort_index");

ALTER TABLE "shopping_list_quotes"
  ALTER COLUMN "source_image_url" DROP NOT NULL;

ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "source_kind" text DEFAULT 'photo' NOT NULL;

ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "starter_bundle_id" uuid;

ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "starter_bundle_snapshot" jsonb;

ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "customer_note" text;

CREATE INDEX IF NOT EXISTS "shopping_list_quotes_source_kind_idx"
  ON "shopping_list_quotes" ("source_kind");
