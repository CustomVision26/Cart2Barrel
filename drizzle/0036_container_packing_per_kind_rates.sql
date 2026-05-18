ALTER TABLE "merchant_packing_fee_settings" ADD COLUMN IF NOT EXISTS "multi_barrel_packing_per_unit_cents" integer DEFAULT 8000 NOT NULL;
ALTER TABLE "merchant_packing_fee_settings" ADD COLUMN IF NOT EXISTS "multi_bin_packing_per_unit_cents" integer DEFAULT 4500 NOT NULL;

-- Repurpose legacy single-kind columns as single-container packing fees when still zero.
UPDATE "merchant_packing_fee_settings"
SET
  "barrel_shipping_fee_cents" = CASE
    WHEN "barrel_shipping_fee_cents" = 0 THEN 10000
    ELSE "barrel_shipping_fee_cents"
  END,
  "bin_shipping_fee_cents" = CASE
    WHEN "bin_shipping_fee_cents" = 0 THEN 5500
    ELSE "bin_shipping_fee_cents"
  END
WHERE "singleton_key" = 'default';
