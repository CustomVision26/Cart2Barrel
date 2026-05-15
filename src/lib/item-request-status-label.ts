import type { ItemRequest, Order } from "@/db/schema";

const LABELS: Record<ItemRequest["status"], string> = {
  pending: "New request",
  quoted: "Quoted",
  approved: "In Cart",
  rejected: "Missing Item",
  withdrawn: "Deleted from cart",
};

export function itemRequestStatusLabel(status: ItemRequest["status"]): string {
  return LABELS[status];
}

/**
 * Admin tables: `approved` still means "accepted quote" in the DB. Customer cart only shows
 * approved rows that are not on an order — show order state when `orderStatus` is set.
 */
export function adminItemRequestStatusDisplay(
  status: ItemRequest["status"],
  orderStatus: Order["status"] | null
): string {
  if (status !== "approved") {
    return LABELS[status];
  }
  if (!orderStatus) {
    return LABELS.approved;
  }
  const orderLabels: Record<Order["status"], string> = {
    pending: "Awaiting Purchase",
    paid: "Awaiting Purchase",
    purchasing: "Purchasing",
    completed: "Fully Received",
  };
  return orderLabels[orderStatus];
}
