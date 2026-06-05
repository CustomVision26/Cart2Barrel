ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_missing_reason" text;
ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_missing_reason" text;
