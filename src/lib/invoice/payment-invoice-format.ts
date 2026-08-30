import { formatUsd } from "@/lib/admin-markup";
import type { PaymentInvoiceDocument } from "@/lib/invoice/payment-invoice-types";

export type PaymentInvoiceSummaryRow = {
  label: string;
  amountCents: number;
  emphasize?: boolean;
};

/** Totals block: merchandise subtotal, warehouse shipping when charged, then total / paid. */
export function paymentInvoiceSummaryRows(
  invoice: PaymentInvoiceDocument,
): PaymentInvoiceSummaryRow[] {
  const rows: PaymentInvoiceSummaryRow[] = [
    { label: "Subtotal", amountCents: invoice.subtotalCents },
  ];
  if (invoice.shippingCents > 0) {
    rows.push({ label: "Shipping", amountCents: invoice.shippingCents });
  }
  rows.push(
    { label: "Total", amountCents: invoice.totalCents, emphasize: true },
    { label: "Amount paid", amountCents: invoice.amountPaidCents, emphasize: true },
  );
  return rows;
}

export function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatInvoiceDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInvoiceMoney(cents: number): string {
  return formatUsd(cents);
}

export function buildInvoiceNumber(orderId: string): string {
  const compact = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `C2B-${compact}`;
}

export function buildReceiptNumber(
  orderId: string,
  stripeReceiptNumber: string | null,
): string {
  const fromStripe = stripeReceiptNumber?.trim();
  if (fromStripe) return fromStripe;
  return `RCPT-${orderId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function formatCardPaymentMethodLabel(
  brand: string | null | undefined,
  last4: string | null | undefined,
): string {
  const digits = last4?.trim();
  const cardBrand = brand?.trim();
  if (cardBrand && digits) {
    const label = cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1);
    return `${label} - ${digits}`;
  }
  if (digits) return `Card - ${digits}`;
  return "Card payment";
}
