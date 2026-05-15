CREATE TYPE "public"."order_item_refund_reason_kind" AS ENUM('defective_or_damaged', 'wrong_item', 'not_received', 'not_as_described', 'duplicate_charge', 'changed_mind', 'other');--> statement-breakpoint
CREATE TYPE "public"."order_item_refund_request_status" AS ENUM('pending_approval', 'rejected', 'fulfilled');--> statement-breakpoint
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'customer_refund_request_submitted';--> statement-breakpoint
CREATE TABLE "order_item_refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"reason_kind" "order_item_refund_reason_kind" NOT NULL,
	"details" text NOT NULL,
	"requested_amount_cents" integer,
	"status" "order_item_refund_request_status" DEFAULT 'pending_approval' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_clerk_user_id" text,
	"rejection_note" text,
	"fulfilled_stripe_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_refund_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "order_item_refund_requests_order_item_id_idx" ON "order_item_refund_requests" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_item_refund_requests_status_idx" ON "order_item_refund_requests" USING btree ("status");
