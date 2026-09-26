import type { OutboundShippingChargeLineView } from "@/lib/barrel-outbound-shipping-charge";

export type OutboundOffPlatformReceiptPdfPayload = {
  chargeId: string;
  headline: string;
  statusLabel: string;
  submittedAtLabel: string | null;
  vendorName: string;
  vendorPhone: string | null;
  payIdLabel: string | null;
  payId: string | null;
  payAccount: string | null;
  payerName: string | null;
  paymentReference: string | null;
  methodKey: string | null;
  receiptUrl: string | null;
  totalCents: number;
  lines: OutboundShippingChargeLineView[];
  filename: string;
};
