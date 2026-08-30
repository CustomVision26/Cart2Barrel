ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'hub_stock_return_requested';--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shippo_return_transaction_id" text;--> statement-breakpoint
ALTER TABLE "hub_stock_order_items" ADD COLUMN IF NOT EXISTS "shippo_return_label_url" text;
