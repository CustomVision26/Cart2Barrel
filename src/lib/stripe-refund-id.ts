/** Stripe Refund (`re_`) or Payment Refund (`pyr_`) identifiers stored on `order_item_refunds`. */
export function isStripeRefundId(value: string | null | undefined): boolean {
  const id = value?.trim() ?? "";
  return id.startsWith("re_") || id.startsWith("pyr_");
}
