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
    case "outside_purchase_intake":
      return "Outside purchase intake (staff)";
    case "outside_purchase_payment_prompted":
      return "Customer prompted to pay";
    case "outside_purchase_added_to_cart":
      return "Added to cart";
    case "outside_purchase_removed_from_cart":
      return "Removed from cart";
    case "outside_purchase_withdrawn_from_active":
      return "Removed from Active";
    case "outside_purchase_reinstated_to_active":
      return "Reinstated to Active";
    case "outside_purchase_return_requested":
      return "Return to retailer requested";
    case "outside_purchase_return_estimate_ready":
      return "Return estimate ready";
    case "outside_purchase_checkout_paid":
      return "Checkout paid · service fee";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
