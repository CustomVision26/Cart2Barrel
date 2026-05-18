ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_received_condition" text;
ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_shelf_location" text;
