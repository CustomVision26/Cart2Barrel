ALTER TABLE "barrel_shipping_intakes"
  ADD COLUMN IF NOT EXISTS "selected_broker_key" text;

ALTER TABLE "barrel_shipping_intakes"
  ADD COLUMN IF NOT EXISTS "selected_courier_key" text;
