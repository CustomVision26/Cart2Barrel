CREATE TABLE IF NOT EXISTS "user_cart_container_packing_fees" (
  "clerk_user_id" text PRIMARY KEY NOT NULL,
  "barrel_count" integer DEFAULT 0 NOT NULL,
  "bin_count" integer DEFAULT 0 NOT NULL,
  "barrel_packing_fee_cents" integer DEFAULT 0 NOT NULL,
  "bin_packing_fee_cents" integer DEFAULT 0 NOT NULL,
  "total_packing_fee_cents" integer DEFAULT 0 NOT NULL,
  "applied_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_cart_container_packing_fees"
  ADD CONSTRAINT "user_cart_container_packing_fees_clerk_user_id_profiles_clerk_user_id_fk"
  FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
  ON DELETE cascade ON UPDATE no action;
