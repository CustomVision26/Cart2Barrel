ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_purchase_retailer_tracking_company" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_purchase_retailer_tracking_number" text;
