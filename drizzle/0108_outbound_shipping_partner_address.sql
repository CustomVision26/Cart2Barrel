ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "partner_address" text;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "partner_country" text;
