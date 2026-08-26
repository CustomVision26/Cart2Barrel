ALTER TABLE "hub_stock_products" ADD COLUMN IF NOT EXISTS "parcel_weight_oz" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_products" ADD COLUMN IF NOT EXISTS "parcel_length_in" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_products" ADD COLUMN IF NOT EXISTS "parcel_width_in" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_products" ADD COLUMN IF NOT EXISTS "parcel_height_in" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_cart_items" ADD COLUMN IF NOT EXISTS "shipping_cents" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "hub_stock_cart_items" ADD COLUMN IF NOT EXISTS "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "hub_stock_cart_items" ADD COLUMN IF NOT EXISTS "shipping_service" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shipping_cents" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shipping_service" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hub_ship_from_settings" (
  "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "name" text,
  "phone" text,
  "line1" text,
  "line2" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "country" text DEFAULT 'United States' NOT NULL,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
