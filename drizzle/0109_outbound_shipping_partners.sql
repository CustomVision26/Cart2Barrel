CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_partners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "barrel_id" uuid NOT NULL,
  "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL,
  "name" text NOT NULL,
  "location" text,
  "address" text,
  "country" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "barrel_outbound_shipping_partners"
    ADD CONSTRAINT "barrel_outbound_shipping_partners_barrel_id_fk"
    FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_partners_barrel_kind_idx"
  ON "barrel_outbound_shipping_partners" USING btree ("barrel_id", "charge_kind");
