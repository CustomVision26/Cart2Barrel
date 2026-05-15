ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_at" timestamp with time zone;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_qty" integer;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_condition" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_shelf_location" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_barcode" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "warehouse_received_proof_photo_count" integer;
