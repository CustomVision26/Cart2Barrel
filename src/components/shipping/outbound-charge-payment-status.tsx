"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  isOffPlatformPaymentPendingReview,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

import {
  chargesWithPaymentReceipts,
  OutboundPaymentReceiptDialog,
} from "@/components/shipping/outbound-payment-receipt-dialog";

export function PaidVendorBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      Paid
    </span>
  );
}

export function SubmittedPaymentBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      Submitted
    </span>
  );
}

export function freightPaymentInvoiceHref(
  orderId: string,
  audience: "dashboard" | "customer" | "admin" = "dashboard",
): string {
  const params = new URLSearchParams({
    orderId,
    format: "pdf",
    disposition: "inline",
  });
  const base =
    audience === "admin"
      ? "/api/admin/payment-invoice"
      : "/api/dashboard/payment-invoice";
  return `${base}?${params.toString()}`;
}

export function OutboundChargePaymentStatus({
  charges,
  customerName,
  customerEmail,
  showCustomer = true,
  audience = "dashboard",
  className,
}: {
  charges: readonly BarrelOutboundShippingChargeView[];
  customerName?: string | null;
  customerEmail?: string | null;
  showCustomer?: boolean;
  audience?: "dashboard" | "customer" | "admin";
  className?: string;
}) {
  const list = [...charges];
  const paid = list.some((charge) => Boolean(charge.paidAt));
  const submitted = list.some((charge) =>
    isOffPlatformPaymentPendingReview(charge),
  );
  const invoiceOrderIds = [
    ...new Set(
      list
        .map((charge) => charge.paidOrderId?.trim() || "")
        .filter((id) => id.length > 0),
    ),
  ];
  const receiptCharges = chargesWithPaymentReceipts(list);
  if (
    !paid &&
    !submitted &&
    invoiceOrderIds.length === 0 &&
    receiptCharges.length === 0
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1.5",
        className,
      )}
    >
      {paid ? <PaidVendorBadge /> : null}
      {submitted ? <SubmittedPaymentBadge /> : null}
      {invoiceOrderIds.map((orderId) => (
        <a
          key={orderId}
          href={freightPaymentInvoiceHref(orderId, audience)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
        >
          Receipt
        </a>
      ))}
      {receiptCharges.length > 0 ?
        <OutboundPaymentReceiptDialog
          charges={receiptCharges}
          customerName={customerName}
          customerEmail={customerEmail}
          showCustomer={showCustomer}
          triggerLabel="View receipt"
          triggerSize="xs"
        />
      : null}
    </div>
  );
}
