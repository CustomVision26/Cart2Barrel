CREATE TABLE "delivery_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"requested_by_clerk_user_id" text NOT NULL,
	"ops_destinations" text NOT NULL,
	"customer_email_attempted" text,
	"notified_ops_at" timestamp with time zone,
	"notified_customer_at" timestamp with time zone,
	"notify_errors" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_requests_order_item_id_idx" ON "delivery_requests" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "delivery_requests_created_at_idx" ON "delivery_requests" USING btree ("created_at");
