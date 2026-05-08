CREATE TYPE "public"."item_request_line_snapshot_phase" AS ENUM('customer_submission', 'pre_admin_estimate_edit', 'post_admin_estimate_edit');--> statement-breakpoint
CREATE TABLE "item_request_line_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_request_id" uuid NOT NULL,
	"item_quote_id" uuid,
	"phase" "item_request_line_snapshot_phase" NOT NULL,
	"product_url" text NOT NULL,
	"product_name" text,
	"product_size" text,
	"product_color" text,
	"quantity" integer NOT NULL,
	"note" text,
	"product_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "request_quantity" integer;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "request_product_size" text;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "request_product_color" text;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "request_product_name" text;--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD CONSTRAINT "item_request_line_snapshots_item_request_id_item_requests_id_fk" FOREIGN KEY ("item_request_id") REFERENCES "public"."item_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD CONSTRAINT "item_request_line_snapshots_item_quote_id_item_quotes_id_fk" FOREIGN KEY ("item_quote_id") REFERENCES "public"."item_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_request_line_snapshots_item_request_id_created_at_idx" ON "item_request_line_snapshots" USING btree ("item_request_id","created_at");