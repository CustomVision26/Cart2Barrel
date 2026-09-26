ALTER TABLE "order_container_items"
  ADD COLUMN IF NOT EXISTS "packaging_fee_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "order_container_items"
  ADD COLUMN IF NOT EXISTS "packaging_per_unit_cents" integer DEFAULT 0 NOT NULL;
