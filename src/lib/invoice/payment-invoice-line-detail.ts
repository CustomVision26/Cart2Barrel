import { buildCheckoutProductDetailText } from "@/lib/checkout-product-reference";

type PaymentInvoiceProductDetailInput = {
  siteName: string | null;
  batchNumber: string | null;
  orderItemId: string;
  outsidePurchaseReference: string | null;
  productUrl: string;
  source: string;
  quantity: number;
};

/** Secondary line under the product title on payment invoices / receipts. */
export function buildPaymentInvoiceProductDetail(
  input: PaymentInvoiceProductDetailInput,
): string | null {
  return buildCheckoutProductDetailText({
    batchNumber: input.batchNumber,
    orderItemId: input.orderItemId,
    outsidePurchaseReference: input.outsidePurchaseReference,
    productUrl: input.productUrl,
    source: input.source as "customer_url" | "outside_purchase",
    quantity: input.quantity,
    siteName: input.siteName,
  });
}
