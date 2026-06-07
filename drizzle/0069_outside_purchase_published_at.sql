ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "outside_purchase_published_at" timestamp with time zone;

ALTER TYPE "item_request_line_snapshot_phase"
  ADD VALUE IF NOT EXISTS 'outside_purchase_published';

ALTER TYPE "item_request_line_snapshot_phase"
  ADD VALUE IF NOT EXISTS 'outside_purchase_unpublished';

-- Existing outside-purchase lines stay visible to customers until staff withdraws them.
UPDATE "item_requests"
SET "outside_purchase_published_at" = "created_at"
WHERE "source" = 'outside_purchase'
  AND "outside_purchase_published_at" IS NULL;
