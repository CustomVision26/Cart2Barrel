-- Align with existing Neon columns (see schema.ts companyPurchaseInboundMethod / storePickupAt).
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_purchase_delivery_method" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_purchase_pickup_at" timestamptz;
