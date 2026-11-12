ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "merchandise_budget_cents" integer;

ALTER TABLE "shopping_list_quotes"
  ADD COLUMN IF NOT EXISTS "builder_snapshot" jsonb;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "retailer" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "seller_name" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "retailer_product_url" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "pack_size" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "observed_price_cents" integer;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "currency" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "availability" text;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "price_retrieved_at" timestamp with time zone;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "needs_staff_review" boolean DEFAULT false NOT NULL;

ALTER TABLE "shopping_list_quote_lines"
  ADD COLUMN IF NOT EXISTS "retailer_delivery_cents" integer;

CREATE TABLE IF NOT EXISTS "budget_barrel_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_user_id" text NOT NULL REFERENCES "profiles"("clerk_user_id") ON DELETE cascade,
  "status" text DEFAULT 'open' NOT NULL,
  "idempotency_key" text,
  "merchandise_budget_cents" integer NOT NULL,
  "request" jsonb NOT NULL,
  "offers" jsonb NOT NULL,
  "one_store" jsonb,
  "multi_store" jsonb,
  "provider_notes" jsonb NOT NULL,
  "price_checked_at" timestamp with time zone NOT NULL,
  "shopping_list_quote_id" uuid,
  "batch_quote_session_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "budget_barrel_drafts_clerk_user_id_idx"
  ON "budget_barrel_drafts" ("clerk_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "budget_barrel_drafts_user_idempotency_uidx"
  ON "budget_barrel_drafts" ("clerk_user_id", "idempotency_key");
