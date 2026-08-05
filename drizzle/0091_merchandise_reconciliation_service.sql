ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_service_cents" integer DEFAULT 0 NOT NULL;

ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_service_cents" integer DEFAULT 0 NOT NULL;
