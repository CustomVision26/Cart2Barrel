ALTER TABLE "item_quotes" ADD COLUMN IF NOT EXISTS "packing_fee_cents" integer DEFAULT 0 NOT NULL;
