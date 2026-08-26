ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "parcel_weight_oz" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "parcel_length_in" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "parcel_width_in" double precision;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "parcel_height_in" double precision;
