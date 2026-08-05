CREATE TABLE IF NOT EXISTS "quote_expiry_settings" (
  "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "expiry_days" integer DEFAULT 7 NOT NULL,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "quote_expiry_settings" ("singleton_key", "expiry_days")
VALUES ('default', 7)
ON CONFLICT ("singleton_key") DO NOTHING;
