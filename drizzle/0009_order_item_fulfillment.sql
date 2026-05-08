ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE 'checkout_paid_pending_delivery';--> statement-breakpoint
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE 'company_purchase_pending_delivery';--> statement-breakpoint
CREATE TYPE "public"."order_item_fulfillment_status" AS ENUM('pending_payment', 'paid_pending_company_purchase', 'company_purchase_pending_delivery');--> statement-breakpoint
ALTER TABLE "item_quotes" ADD COLUMN "checkout_snapshot_kind" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "fulfillment_status" "order_item_fulfillment_status" DEFAULT 'pending_payment' NOT NULL;--> statement-breakpoint
UPDATE "order_items" AS oi SET "fulfillment_status" = 'paid_pending_company_purchase' FROM "orders" AS o WHERE o.id = oi.order_id AND o.status = 'paid';
