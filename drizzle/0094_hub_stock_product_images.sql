CREATE TABLE IF NOT EXISTS "hub_stock_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_stock_product_images_product_id_idx" ON "hub_stock_product_images" USING btree ("product_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_product_images" ADD CONSTRAINT "hub_stock_product_images_product_id_hub_stock_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."hub_stock_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
