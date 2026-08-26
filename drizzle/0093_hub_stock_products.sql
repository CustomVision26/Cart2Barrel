ALTER TYPE "public"."item_request_source" ADD VALUE IF NOT EXISTS 'hub_stock';--> statement-breakpoint
ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'hub_stock_pending_us_shipment';--> statement-breakpoint
ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'hub_stock_pending_container';--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."hub_stock_destination" AS ENUM('us_address', 'overseas_container');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hub_stock_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"size_label" text NOT NULL,
	"color_label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_usd_cents" integer NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hub_stock_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"destination" "hub_stock_destination" NOT NULL,
	"ship_line1" text,
	"ship_line2" text,
	"ship_city" text,
	"ship_state" text,
	"ship_postal_code" text,
	"ship_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hub_stock_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"item_request_id" uuid NOT NULL,
	"product_id" uuid,
	"destination" "hub_stock_destination" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"name_snapshot" text NOT NULL,
	"size_snapshot" text NOT NULL,
	"color_snapshot" text NOT NULL,
	"ship_line1" text,
	"ship_line2" text,
	"ship_city" text,
	"ship_state" text,
	"ship_postal_code" text,
	"ship_country" text,
	CONSTRAINT "hub_stock_order_items_order_item_id_unique" UNIQUE("order_item_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_stock_products_active_created_at_idx" ON "hub_stock_products" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hub_stock_cart_items_user_product_destination_unique" ON "hub_stock_cart_items" USING btree ("clerk_user_id","product_id","destination");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_stock_cart_items_clerk_user_id_idx" ON "hub_stock_cart_items" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_stock_order_items_order_id_idx" ON "hub_stock_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_stock_order_items_item_request_id_idx" ON "hub_stock_order_items" USING btree ("item_request_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_cart_items" ADD CONSTRAINT "hub_stock_cart_items_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_cart_items" ADD CONSTRAINT "hub_stock_cart_items_product_id_hub_stock_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."hub_stock_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_order_items" ADD CONSTRAINT "hub_stock_order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_order_items" ADD CONSTRAINT "hub_stock_order_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_order_items" ADD CONSTRAINT "hub_stock_order_items_item_request_id_item_requests_id_fk" FOREIGN KEY ("item_request_id") REFERENCES "public"."item_requests"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hub_stock_order_items" ADD CONSTRAINT "hub_stock_order_items_product_id_hub_stock_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."hub_stock_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
