ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shippo_transaction_id" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shippo_label_url" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "tracking_status" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "tracking_status_details" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "tracking_updated_at" timestamp with time zone;
