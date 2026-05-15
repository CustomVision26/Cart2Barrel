ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'product_return_awaiting_delivery';--> statement-breakpoint
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'product_return_tracking_saved';
