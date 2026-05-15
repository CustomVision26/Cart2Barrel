ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "internal_quoted_sale_tax_cents" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_total_details_tax_cents" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_fee_cents" integer;
