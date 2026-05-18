DO $$ BEGIN
  CREATE TYPE "public"."outside_purchase_return_request_status" AS ENUM(
    'submitted',
    'estimate_ready',
    'estimate_accepted',
    'paid',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "outside_purchase_return_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_request_id" uuid NOT NULL REFERENCES "item_requests"("id") ON DELETE CASCADE,
  "clerk_user_id" text NOT NULL,
  "status" "outside_purchase_return_request_status" DEFAULT 'submitted' NOT NULL,
  "return_label_image_url" text,
  "return_window_start" timestamp with time zone,
  "return_window_end" timestamp with time zone,
  "customer_notes" text,
  "return_service_fee_cents" integer,
  "return_staff_note" text,
  "estimate_ready_at" timestamp with time zone,
  "estimate_accepted_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "outside_purchase_return_requests_item_request_id_unique"
  ON "outside_purchase_return_requests" ("item_request_id");
CREATE INDEX IF NOT EXISTS "outside_purchase_return_requests_clerk_user_id_idx"
  ON "outside_purchase_return_requests" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "outside_purchase_return_requests_status_idx"
  ON "outside_purchase_return_requests" ("status");

ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_return_requested';
ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_return_estimate_ready';
