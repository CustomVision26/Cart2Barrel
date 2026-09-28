CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "charge_id" uuid NOT NULL,
  "barrel_id" uuid NOT NULL,
  "clerk_user_id" text NOT NULL,
  "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL,
  "refund_path" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "amount_cents" integer NOT NULL,
  "stripe_refund_id" text,
  "support_ticket_id" uuid,
  "completed_at" timestamp with time zone,
  "completed_by_clerk_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_charge_uidx"
  ON "barrel_outbound_shipping_refund_requests" ("charge_id");
CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_barrel_idx"
  ON "barrel_outbound_shipping_refund_requests" ("barrel_id");
CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_clerk_idx"
  ON "barrel_outbound_shipping_refund_requests" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_status_idx"
  ON "barrel_outbound_shipping_refund_requests" ("status");
