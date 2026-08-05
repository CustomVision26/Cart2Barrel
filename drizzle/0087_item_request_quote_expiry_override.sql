ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "quote_expiry_minutes_override" integer;
