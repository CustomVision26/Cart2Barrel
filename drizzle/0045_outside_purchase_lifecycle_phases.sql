ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_added_to_cart';
ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_removed_from_cart';
ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_withdrawn_from_active';
ALTER TYPE "item_request_line_snapshot_phase" ADD VALUE IF NOT EXISTS 'outside_purchase_reinstated_to_active';
