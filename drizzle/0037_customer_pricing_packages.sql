CREATE TABLE IF NOT EXISTS "customer_pricing_packages" (
  "clerk_user_id" text PRIMARY KEY NOT NULL,
  "label" text,
  "packing_fee_per_line_cents" integer DEFAULT 0 NOT NULL,
  "single_barrel_packing_fee_cents" integer DEFAULT 10000 NOT NULL,
  "multi_barrel_packing_per_unit_cents" integer DEFAULT 8000 NOT NULL,
  "single_bin_packing_fee_cents" integer DEFAULT 5500 NOT NULL,
  "multi_bin_packing_per_unit_cents" integer DEFAULT 4500 NOT NULL,
  "service_tiers_json" jsonb,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "customer_pricing_packages"
  ADD CONSTRAINT "customer_pricing_packages_clerk_user_id_profiles_clerk_user_id_fk"
  FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
  ON DELETE cascade ON UPDATE no action;
