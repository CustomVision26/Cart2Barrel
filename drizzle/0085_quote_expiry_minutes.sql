-- Store quote expiry as minutes (min 1); migrate legacy whole-day values.
ALTER TABLE "quote_expiry_settings"
  ADD COLUMN IF NOT EXISTS "expiry_minutes" integer;

UPDATE "quote_expiry_settings"
SET "expiry_minutes" = GREATEST(1, COALESCE("expiry_days", 7) * 24 * 60)
WHERE "expiry_minutes" IS NULL;

ALTER TABLE "quote_expiry_settings"
  ALTER COLUMN "expiry_minutes" SET DEFAULT 10080;

ALTER TABLE "quote_expiry_settings"
  ALTER COLUMN "expiry_minutes" SET NOT NULL;

ALTER TABLE "quote_expiry_settings"
  DROP COLUMN IF EXISTS "expiry_days";
