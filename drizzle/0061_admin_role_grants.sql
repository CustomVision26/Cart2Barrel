CREATE TABLE IF NOT EXISTS "admin_role_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_clerk_user_id" text NOT NULL,
  "granted_role" text NOT NULL,
  "granted_by_clerk_user_id" text NOT NULL,
  "granted_by_display_name" text NOT NULL,
  "target_display_name" text NOT NULL,
  "target_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "admin_role_grants"
  ADD CONSTRAINT "admin_role_grants_target_clerk_user_id_profiles_clerk_user_id_fk"
  FOREIGN KEY ("target_clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "admin_role_grants_created_idx"
  ON "admin_role_grants" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "admin_role_grants_target_idx"
  ON "admin_role_grants" USING btree ("target_clerk_user_id");
