DO $$ BEGIN
  CREATE TYPE "order_item_product_return_request_status" AS ENUM(
    'submitted',
    'fulfilled',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "order_item_product_return_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_item_id" uuid NOT NULL,
  "clerk_user_id" text NOT NULL,
  "reason_kind" "order_item_refund_reason_kind" NOT NULL,
  "details" text NOT NULL,
  "return_window_start" timestamp with time zone,
  "return_window_end" timestamp with time zone,
  "customer_notes" text,
  "status" "order_item_product_return_request_status" DEFAULT 'submitted' NOT NULL,
  "fulfilled_at" timestamp with time zone,
  "fulfilled_by_clerk_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_item_product_return_requests_order_item_id_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_item_product_return_requests_order_item_id_unique"
  ON "order_item_product_return_requests" ("order_item_id");
CREATE INDEX IF NOT EXISTS "order_item_product_return_requests_clerk_user_id_idx"
  ON "order_item_product_return_requests" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "order_item_product_return_requests_status_idx"
  ON "order_item_product_return_requests" ("status");

ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'product_return_requested';
