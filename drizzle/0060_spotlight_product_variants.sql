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
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "spotlight_product_variants"
  ADD CONSTRAINT "spotlight_product_variants_parent_product_id_fk"
  FOREIGN KEY ("parent_product_id")
  REFERENCES "spotlight_category_products"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spotlight_product_variants_parent_active_sort_idx"
ON "spotlight_product_variants" USING btree ("parent_product_id", "is_active", "sort_index");
