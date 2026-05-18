DO $$ BEGIN
  CREATE TYPE "public"."item_request_source" AS ENUM('customer_url', 'outside_purchase');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "source" "item_request_source" DEFAULT 'customer_url' NOT NULL;
ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "outside_purchase_reference" text;

CREATE UNIQUE INDEX IF NOT EXISTS "item_requests_outside_purchase_reference_unique"
  ON "item_requests" ("outside_purchase_reference")
  WHERE "outside_purchase_reference" IS NOT NULL;

ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_intake';
