ALTER TABLE "item_quotes" ADD COLUMN IF NOT EXISTS "recorded_by_clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD COLUMN IF NOT EXISTS "recorded_by_clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "batch_quote_estimates" ADD COLUMN IF NOT EXISTS "recorded_by_clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_by_clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_purchase_updated_by_clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "barrel_outbound_shipping_charges" ADD COLUMN IF NOT EXISTS "recorded_by_clerk_user_id" text;
