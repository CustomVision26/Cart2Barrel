ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_shipping_cents" integer DEFAULT 0 NOT NULL;

ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "checkout_tax_cents" integer DEFAULT 0 NOT NULL;

ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_shipping_cents" integer DEFAULT 0 NOT NULL;

ALTER TABLE "order_item_merchandise_reconciliations"
  ADD COLUMN IF NOT EXISTS "actual_tax_cents" integer DEFAULT 0 NOT NULL;
