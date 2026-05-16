ALTER TABLE "merchant_packing_fee_settings" ADD COLUMN IF NOT EXISTS "barrel_shipping_fee_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "merchant_packing_fee_settings" ADD COLUMN IF NOT EXISTS "bin_shipping_fee_cents" integer DEFAULT 0 NOT NULL;
