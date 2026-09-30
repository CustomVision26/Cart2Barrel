"use client";

import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isOffPlatformPaymentPendingReview,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type ReceiptChargeProps = {
  charge: BarrelOutboundShippingChargeView;
  customerName?: string | null;
  customerEmail?: string | null;
  showCustomer?: boolean;
};

function isPdfReceipt(url: string): boolean {
  return /\.pdf(?:$|\?)/i.test(url);
}

export function outboundPaymentReceiptPdfHref(chargeId: string): string {
  return `/api/dashboard/outbound-payment-receipt?chargeId=${encodeURIComponent(chargeId)}`;
}

function submittedLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function receiptPanelClass(pendingReview: boolean): string {
  return pendingReview
    ? "space-y-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3.5 py-3"
    : "space-y-3 rounded-md border border-border/70 bg-muted px-3.5 py-3";
}

export function PaymentReceiptDetails({
  charge,
  customerName,
  customerEmail,
  showCustomer = true,
}: ReceiptChargeProps) {
  const methodLabel = charge.offPlatformPaymentMethod
    ? OFF_PLATFORM_PAYMENT_METHOD_LABELS[charge.offPlatformPaymentMethod]
    : "Payment";
  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind];
  const vendorPayId =
    charge.offPlatformPaymentMethod === "zelle"
      ? charge.partnerZelleId
      : charge.offPlatformPaymentMethod === "cashapp"
        ? charge.partnerCashappId
        : null;
  const receiptUrl = charge.offPlatformReceiptUrl?.trim() || null;
  const submittedAt = charge.offPlatformSubmittedAt
    ? submittedLabel(charge.offPlatformSubmittedAt)
    : null;
  const pendingReview = isOffPlatformPaymentPendingReview(charge);
  const customerLabel = customerName?.trim() || customerEmail?.trim() || null;

  return (
    <>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {pendingReview ? "Payment to verify" : "Verified payment"}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {kindLabel} · {methodLabel} · {formatUsd(charge.totalCents)}
        </p>
        {submittedAt ?
          <p className="text-xs text-muted-foreground">Submitted {submittedAt}</p>
        : null}
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {showCustomer && customerLabel ?
          <div>
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-medium text-foreground">{customerLabel}</dd>
            {customerEmail && customerName ?
              <dd className="text-muted-foreground">{customerEmail}</dd>
            : null}
          </div>
        : null}
        <div>
          <dt className="text-muted-foreground">Vendor</dt>
          <dd className="font-medium text-foreground">
            {charge.partnerName || kindLabel}
          </dd>
          {charge.partnerPhone ?
            <dd className="text-muted-foreground">Tel {charge.partnerPhone}</dd>
          : null}
        </div>
        {vendorPayId ?
          <div>
            <dt className="text-muted-foreground">
              {charge.offPlatformPaymentMethod === "zelle"
                ? "Company Zelle ID"
                : "Company Cash App ID"}
            </dt>
            <dd className="font-medium text-foreground">{vendorPayId}</dd>
            {(charge.offPlatformPaymentMethod === "zelle"
              ? charge.partnerZelleAccount
              : charge.partnerCashappAccount) ?
              <dd className="text-muted-foreground">
                Account:{" "}
                {charge.offPlatformPaymentMethod === "zelle"
                  ? charge.partnerZelleAccount
                  : charge.partnerCashappAccount}
              </dd>
            : null}
          </div>
        : null}
        {charge.offPlatformPayerName ?
          <div>
            <dt className="text-muted-foreground">
              {showCustomer ? "Customer account name" : "Account name"}
            </dt>
            <dd className="font-medium text-foreground">
              {charge.offPlatformPayerName}
            </dd>
          </div>
        : null}
      </dl>

      {receiptUrl ?
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Payment receipt</p>
          {isPdfReceipt(receiptUrl) ?
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open receipt PDF
            </a>
          : (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-border/80 bg-background"
            >
              <img
                src={receiptUrl}
                alt="Payment receipt"
                className="max-h-64 w-full bg-background object-contain"
              />
            </a>
          )}
        </div>
      : charge.offPlatformPaymentMethod === "local_office" ?
        <p className="text-xs text-muted-foreground">
          These charges were selected to be paid at the local office.
        </p>
      : null}

      <a
        href={outboundPaymentReceiptPdfHref(charge.chargeId)}
        className={cn(
          buttonVariants({ variant: "outline", size: "xs" }),
          "inline-flex w-fit items-center gap-1",
        )}
      >
        <Download className="size-3" aria-hidden />
        Download PDF
      </a>
    </>
  );
}

export function chargesWithPaymentReceipts(
  charges: readonly BarrelOutboundShippingChargeView[],
): BarrelOutboundShippingChargeView[] {
  return charges.filter(
    (charge) =>
      Boolean(charge.offPlatformReceiptUrl?.trim()) ||
      Boolean(charge.offPlatformSubmittedAt),
  );
}

type OutboundPaymentReceiptDialogProps = {
  charges: BarrelOutboundShippingChargeView[];
  customerName?: string | null;
  customerEmail?: string | null;
  showCustomer?: boolean;
  triggerLabel?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerSize?: VariantProps<typeof buttonVariants>["size"];
  triggerClassName?: string;
};

export function OutboundPaymentReceiptDialog({
  charges,
  customerName,
  customerEmail,
  showCustomer = true,
  triggerLabel = "View receipt",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: OutboundPaymentReceiptDialogProps) {
  const copies = chargesWithPaymentReceipts(charges);
  if (copies.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: triggerVariant, size: triggerSize }),
          triggerClassName,
        )}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Payment receipt</DialogTitle>
          <DialogDescription>
            Transfer details and the submitted receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {copies.map((charge) => (
            <section
              key={charge.chargeId}
              className={receiptPanelClass(isOffPlatformPaymentPendingReview(charge))}
            >
              <PaymentReceiptDetails
                charge={charge}
                customerName={customerName}
                customerEmail={customerEmail}
                showCustomer={showCustomer}
              />
              {charge.paidAt ?
                <p className="text-xs font-medium text-foreground">
                  Payment approved
                  {charge.paymentReferenceNumber
                    ? ` · ${charge.paymentReferenceNumber}`
                    : ""}
                  .
                </p>
              : null}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
