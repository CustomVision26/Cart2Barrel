export type BillingReceiptScope = "order" | "single" | "batch" | "hub" | "shipping";
export type BillingReceiptCategory = "payment" | "proration" | "transfer";

export type CustomerBillingReceiptRecord = {
  id: string;
  scope: BillingReceiptScope;
  category: BillingReceiptCategory;
  label: string;
  subtitle: string | null;
  amountCents: number;
  createdAt: string;
  orderId: string | null;
  orderItemId: string | null;
  batchNumber: string | null;
  batchSessionId: string | null;
  productName: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  /** Public blob URL for Zelle / Cash App (and similar) uploaded receipts. */
  documentUrl: string | null;
  searchHaystack: string;
};
