import type { BatchQuoteSessionEventKind } from "@/db/schema";

/** Customer-facing labels for `batch_quote_sessions.status`. */
export function ownerBatchQuoteSessionStatusBadge(
  status: string
): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "New batch request";
    case "estimated":
      return "Quoted (batch)";
    case "in_cart":
      return "In Cart";
    case "paid_pending_staff_purchase":
      return "Paid: Awaiting staff purchase";
    default:
      return status;
  }
}

/** Customer-facing labels persisted in the status history log. */
export function batchQuoteSessionEventKindLabel(kind: BatchQuoteSessionEventKind): string {
  switch (kind) {
    case "new_batch_request":
      return "New batch request";
    case "quoted_batch":
      return "Quoted (batch)";
    case "in_cart":
      return "In Cart";
    case "paid_pending_staff_purchase":
      return "Paid: Awaiting staff purchase";
    case "returned_to_quoted_batch":
      return "Returned to quoted (batch)";
    case "revision_reopened":
      return "Revision sent to staff";
    default:
      return kind;
  }
}
