ALTER TABLE "item_requests"
  ADD COLUMN IF NOT EXISTS "outside_purchase_payment_prompted_at" timestamp with time zone;

ALTER TYPE "item_request_line_snapshot_phase"
  ADD VALUE IF NOT EXISTS 'outside_purchase_payment_prompted';
