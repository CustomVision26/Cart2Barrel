ALTER TABLE "barrel_outbound_shipping_charges"
  DROP CONSTRAINT IF EXISTS "barrel_outbound_shipping_charges_barrel_unique";

DROP INDEX IF EXISTS "barrel_outbound_shipping_charges_barrel_unique";

DO $$ BEGIN
  CREATE TYPE "barrel_outbound_shipping_charge_kind" AS ENUM ('freight', 'broker', 'courier');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL DEFAULT 'freight';

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "partner_name" text;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "partner_location" text;

CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_barrel_kind_uidx"
  ON "barrel_outbound_shipping_charges" ("barrel_id", "charge_kind");
