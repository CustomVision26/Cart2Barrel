CREATE TABLE IF NOT EXISTS "customer_quote_expiry_settings" (
  "clerk_user_id" text PRIMARY KEY NOT NULL
    REFERENCES "profiles"("clerk_user_id") ON DELETE CASCADE,
  "expiry_minutes" integer NOT NULL,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
