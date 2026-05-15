ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'delivery_received_good_awaiting_barrel';--> statement-breakpoint
ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'delivery_received_item_missing';--> statement-breakpoint
ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'delivery_received_item_damaged';--> statement-breakpoint
ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'delivery_received_wrong_item';
