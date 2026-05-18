ALTER TYPE "public"."order_item_fulfillment_status" ADD VALUE IF NOT EXISTS 'paid_outside_purchase_service_fee';
ALTER TYPE "public"."item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_checkout_paid';
