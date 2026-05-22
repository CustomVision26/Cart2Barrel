-- Home page spotlight carousel (admin-curated product URLs per category).
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
);
--> statement-breakpoint
ALTER TABLE "spotlight_category_products" ADD COLUMN IF NOT EXISTS "price_usd_cents" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spotlight_category_products_slug_active_sort_idx" ON "spotlight_category_products" USING btree ("category_slug","is_active","sort_index");
