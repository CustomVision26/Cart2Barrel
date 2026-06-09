export type BillingReceiptScope = "order" | "single" | "batch";
export type BillingReceiptCategory = "payment" | "proration";

export type CustomerBillingReceiptRecord = {
  id: string;
  scope: BillingReceiptScope;
  category: BillingReceiptCategory;
  label: string;
  subtitle: string | null;
  amountCents: number;
  createdAt: string;
  orderId: string;
  orderItemId: string | null;
  batchNumber: string | null;
  batchSessionId: string | null;
  productName: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  searchHaystack: string;
};
