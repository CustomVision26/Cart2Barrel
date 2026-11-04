CREATE TABLE IF NOT EXISTS "starter_bundle_marquee_settings" (
  "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
