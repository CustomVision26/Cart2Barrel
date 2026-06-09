import type { InvoiceCompanyProfile } from "@/lib/invoice/company-profile";

export type PaymentInvoiceLine = {
  description: string;
  detail: string | null;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};

export type PaymentInvoicePaymentRow = {
  methodLabel: string;
  paidAt: string;
  amountCents: number;
  receiptNumber: string;
};

export type PaymentInvoiceBillTo = {
  name: string;
  addressLines: string[];
  email: string | null;
};

export type PaymentInvoiceDocument = {
  orderId: string;
  invoiceNumber: string;
  receiptNumber: string;
  datePaid: string;
  amountPaidCents: number;
  currency: "USD";
  company: InvoiceCompanyProfile;
  billTo: PaymentInvoiceBillTo;
  lines: PaymentInvoiceLine[];
  subtotalCents: number;
  totalCents: number;
  payments: PaymentInvoicePaymentRow[];
};
