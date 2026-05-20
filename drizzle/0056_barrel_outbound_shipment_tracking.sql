DO $$ BEGIN
  CREATE TYPE "public"."barrel_outbound_shipment_stage" AS ENUM(
    'awaiting_customs_clearance',
    'ready_for_shipment',
    'picked_up',
    'at_shipping_warehouse',
    'on_vessel',
    'arrived_destination',
    'customs_processing',
    'cleared_customs',
    'delivered'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "payment_reference_number" text;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "paid_order_id" uuid;

ALTER TABLE "barrel_outbound_shipping_charges"
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;

DO $$ BEGIN
  ALTER TABLE "barrel_outbound_shipping_charges"
    ADD CONSTRAINT "barrel_outbound_shipping_charges_paid_order_id_orders_id_fk"
    FOREIGN KEY ("paid_order_id") REFERENCES "public"."orders"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_payment_ref_unique"
  ON "barrel_outbound_shipping_charges" USING btree ("payment_reference_number");

CREATE TABLE IF NOT EXISTS "barrel_outbound_shipment_tracking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "barrel_id" uuid NOT NULL,
  "charge_id" uuid,
  "tracking_stage" "barrel_outbound_shipment_stage" DEFAULT 'awaiting_customs_clearance' NOT NULL,
  "stage_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customs_declaration_form_url" text,
  "freight_company_name" text,
  "freight_drop_off_at" timestamp with time zone,
  "estimated_arrival_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "barrel_outbound_shipment_tracking"
    ADD CONSTRAINT "barrel_outbound_shipment_tracking_barrel_id_barrels_id_fk"
    FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "barrel_outbound_shipment_tracking"
    ADD CONSTRAINT "barrel_outbound_shipment_tracking_charge_id_fk"
    FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipment_tracking_barrel_unique"
  ON "barrel_outbound_shipment_tracking" USING btree ("barrel_id");

CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipment_tracking_charge_unique"
  ON "barrel_outbound_shipment_tracking" USING btree ("charge_id");
