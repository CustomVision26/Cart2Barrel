import type { ItemRequestLineSnapshot } from "@/db/schema";

export function itemRequestLineSnapshotPhaseLabel(
  phase: ItemRequestLineSnapshot["phase"]
): string {
  switch (phase) {
    case "customer_submission":
      return "Customer submission";
    case "customer_line_edit":
      return "Customer line update";
    case "removed_from_cart":
      return "Removed from cart";
    case "pre_admin_estimate_edit":
      return "Before estimate save (staff)";
    case "post_admin_estimate_edit":
      return "After estimate save (staff)";
    case "checkout_paid_pending_delivery":
      return "Checkout paid · pending delivery";
    case "company_purchase_pending_delivery":
      return "Company purchase · pending delivery";
    case "batch_estimate_customer_copy":
      return "Batch estimate (customer-facing copy)";
    case "batch_estimate_admin_copy":
      return "Batch estimate (admin-facing copy)";
    case "batch_request_submitted_to_staff":
      return "Batch sent to staff";
    case "warehouse_delivery_received":
      return "Warehouse delivery received";
    case "product_return_tracking_saved":
      return "Product return tracking saved";
    case "customer_refund_request_submitted":
      return "Customer refund request submitted";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
