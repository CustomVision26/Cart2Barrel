import { orders, type Order } from "@/db/schema";

/**
 * Columns loaded for order line list UIs — omits `receipt_email_sent_at` so queries work
 * before migration `0011_order_receipt_and_refunds` is applied.
 */
export const orderListSelect = {
  id: orders.id,
  clerkUserId: orders.clerkUserId,
  status: orders.status,
  totalAmount: orders.totalAmount,
  stripePaymentIntentId: orders.stripePaymentIntentId,
  createdAt: orders.createdAt,
} as const;

export type OrderListCore = Pick<
  Order,
  | "id"
  | "clerkUserId"
  | "status"
  | "totalAmount"
  | "stripePaymentIntentId"
  | "createdAt"
>;
