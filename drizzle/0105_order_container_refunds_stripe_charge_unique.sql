ALTER TABLE "order_container_refunds"
  DROP CONSTRAINT IF EXISTS "order_container_refunds_stripe_refund_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "order_container_refunds_stripe_charge_uidx"
  ON "order_container_refunds" ("stripe_refund_id", "charge_target");
