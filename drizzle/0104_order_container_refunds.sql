DO $$ BEGIN
  CREATE TYPE "order_container_refund_target" AS ENUM ('container', 'packing_fee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "order_container_refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_container_item_id" uuid NOT NULL REFERENCES "order_container_items"("id") ON DELETE CASCADE,
  "clerk_user_id" text NOT NULL,
  "charge_target" "order_container_refund_target" NOT NULL,
  "reason_kind" "order_item_refund_reason_kind" NOT NULL,
  "details" text NOT NULL,
  "requested_amount_cents" integer,
  "status" "order_item_refund_request_status" DEFAULT 'pending_approval' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by_clerk_user_id" text,
  "rejection_note" text,
  "fulfilled_stripe_refund_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "order_container_refund_requests_item_idx"
  ON "order_container_refund_requests" ("order_container_item_id");
CREATE INDEX IF NOT EXISTS "order_container_refund_requests_status_idx"
  ON "order_container_refund_requests" ("status");
CREATE INDEX IF NOT EXISTS "order_container_refund_requests_clerk_user_id_idx"
  ON "order_container_refund_requests" ("clerk_user_id");

CREATE TABLE IF NOT EXISTS "order_container_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_container_item_id" uuid NOT NULL REFERENCES "order_container_items"("id") ON DELETE CASCADE,
  "charge_target" "order_container_refund_target" NOT NULL,
  "amount_cents" integer NOT NULL,
  "stripe_refund_id" text NOT NULL UNIQUE,
  "reason" text,
  "created_by_clerk_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "order_container_refunds_item_idx"
  ON "order_container_refunds" ("order_container_item_id");
