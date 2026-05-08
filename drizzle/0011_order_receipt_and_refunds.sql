ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "receipt_email_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "order_item_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_refund_id" text NOT NULL,
	"reason" text,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_refunds_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "order_item_refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE INDEX "order_item_refunds_order_item_id_idx" ON "order_item_refunds" USING btree ("order_item_id");
