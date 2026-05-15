DO $$ BEGIN
 CREATE TYPE "public"."batch_quote_session_status" AS ENUM('draft', 'submitted', 'estimated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'batch_estimate_customer_copy';
--> statement-breakpoint
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'batch_estimate_admin_copy';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_quote_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"batch_number" text NOT NULL,
	"site_key" text NOT NULL,
	"status" "batch_quote_session_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_quote_sessions_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_quote_session_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_quote_session_id" uuid NOT NULL,
	"item_request_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_quote_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_quote_session_id" uuid NOT NULL,
	"batch_merchandise_total_cents" integer NOT NULL,
	"site_merchandise_total_cents" integer NOT NULL,
	"item_discount_cents" integer NOT NULL,
	"service_handling_total_cents" integer NOT NULL,
	"batch_shipping_total_cents" integer NOT NULL,
	"site_shipping_total_cents" integer NOT NULL,
	"shipping_discount_cents" integer NOT NULL,
	"batch_sale_tax_total_cents" integer NOT NULL,
	"site_sale_tax_total_cents" integer NOT NULL,
	"sale_tax_discount_cents" integer NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_quote_sessions" ADD CONSTRAINT "batch_quote_sessions_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_quote_session_lines" ADD CONSTRAINT "batch_quote_session_lines_batch_quote_session_id_batch_quote_sessions_id_fk" FOREIGN KEY ("batch_quote_session_id") REFERENCES "public"."batch_quote_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_quote_session_lines" ADD CONSTRAINT "batch_quote_session_lines_item_request_id_item_requests_id_fk" FOREIGN KEY ("item_request_id") REFERENCES "public"."item_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_quote_estimates" ADD CONSTRAINT "batch_quote_estimates_batch_quote_session_id_batch_quote_sessions_id_fk" FOREIGN KEY ("batch_quote_session_id") REFERENCES "public"."batch_quote_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "batch_quote_session_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_requests" ADD CONSTRAINT "item_requests_batch_quote_session_id_batch_quote_sessions_id_fk" FOREIGN KEY ("batch_quote_session_id") REFERENCES "public"."batch_quote_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_requests_batch_quote_session_id_idx" ON "item_requests" USING btree ("batch_quote_session_id");
--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD COLUMN IF NOT EXISTS "batch_quote_session_id" uuid;
--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD COLUMN IF NOT EXISTS "audit_memo" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_request_line_snapshots" ADD CONSTRAINT "item_request_line_snapshots_batch_quote_session_id_batch_quote_sessions_id_fk" FOREIGN KEY ("batch_quote_session_id") REFERENCES "public"."batch_quote_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "batch_quote_session_lines_item_request_id_unique" ON "batch_quote_session_lines" USING btree ("item_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_quote_session_lines_batch_session_idx" ON "batch_quote_session_lines" USING btree ("batch_quote_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_quote_estimates_session_id_idx" ON "batch_quote_estimates" USING btree ("batch_quote_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_quote_sessions_clerk_user_id_created_at_idx" ON "batch_quote_sessions" USING btree ("clerk_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_quote_sessions_status_idx" ON "batch_quote_sessions" USING btree ("status");
