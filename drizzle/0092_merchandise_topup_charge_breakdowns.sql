DO $$ BEGIN
  CREATE TYPE "public"."merchandise_topup_charge_breakdown_status" AS ENUM(
    'pending',
    'paid',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "merchandise_topup_charge_breakdowns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_user_id" text NOT NULL,
  "group_key" text NOT NULL,
  "reconciliation_id" uuid NOT NULL,
  "checkout_merchandise_cents" integer NOT NULL,
  "checkout_shipping_cents" integer DEFAULT 0 NOT NULL,
  "checkout_tax_cents" integer DEFAULT 0 NOT NULL,
  "checkout_service_cents" integer DEFAULT 0 NOT NULL,
  "actual_merchandise_cents" integer NOT NULL,
  "actual_shipping_cents" integer DEFAULT 0 NOT NULL,
  "actual_tax_cents" integer DEFAULT 0 NOT NULL,
  "actual_service_cents" integer DEFAULT 0 NOT NULL,
  "delta_cents" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "prior_paid_net_cents" integer DEFAULT 0 NOT NULL,
  "status" "merchandise_topup_charge_breakdown_status" DEFAULT 'pending' NOT NULL,
  "topup_payment_id" uuid,
  "topup_expires_at" timestamp with time zone,
  "created_by_clerk_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_clerk_user_id_idx"
  ON "merchandise_topup_charge_breakdowns" USING btree ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_group_key_idx"
  ON "merchandise_topup_charge_breakdowns" USING btree ("group_key");
CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_recon_id_idx"
  ON "merchandise_topup_charge_breakdowns" USING btree ("reconciliation_id");
CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_status_idx"
  ON "merchandise_topup_charge_breakdowns" USING btree ("status");

DO $$ BEGIN
  ALTER TABLE "merchandise_topup_charge_breakdowns"
    ADD CONSTRAINT "merchandise_topup_charge_breakdowns_clerk_user_id_fk"
    FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "merchandise_topup_charge_breakdowns"
    ADD CONSTRAINT "merchandise_topup_charge_breakdowns_recon_fk"
    FOREIGN KEY ("reconciliation_id")
    REFERENCES "public"."order_item_merchandise_reconciliations"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "merchandise_topup_charge_breakdowns"
    ADD CONSTRAINT "merchandise_topup_charge_breakdowns_payment_fk"
    FOREIGN KEY ("topup_payment_id")
    REFERENCES "public"."merchandise_topup_payments"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
