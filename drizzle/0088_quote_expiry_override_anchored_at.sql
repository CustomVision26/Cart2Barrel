ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "quote_expiry_override_anchored_at" timestamp with time zone;

-- Existing product overrides should grant a fresh window from migration time
-- (previously the clock used quote issued-at, so short overrides looked instantly expired).
UPDATE "item_requests"
SET "quote_expiry_override_anchored_at" = now()
WHERE "quote_expiry_minutes_override" IS NOT NULL
  AND "quote_expiry_override_anchored_at" IS NULL;
