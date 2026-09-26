"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { approveOutboundOffPlatformPaymentAction } from "@/actions/admin-barrel-outbound-shipping-charge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/admin-markup";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isOffPlatformPaymentPendingReview,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  OutboundPaymentReceiptDialog,
  PaymentReceiptDetails,
  receiptPanelClass,
} from "@/components/shipping/outbound-payment-receipt-dialog";

type ReceiptChargeProps = {
  charge: BarrelOutboundShippingChargeView;
  customerName: string | null;
  customerEmail: string | null;
};

export function AdminOutboundPaymentReceiptDialog({
  charges,
  customerName,
  customerEmail,
}: {
  charges: BarrelOutboundShippingChargeView[];
  customerName: string | null;
  customerEmail: string | null;
}) {
  return (
    <OutboundPaymentReceiptDialog
      charges={charges}
      customerName={customerName}
      customerEmail={customerEmail}
    />
  );
}

export function AdminOutboundOffPlatformPaymentReview({
  charge,
  customerName,
  customerEmail,
}: ReceiptChargeProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingReview = isOffPlatformPaymentPendingReview(charge);
  if (!charge.offPlatformSubmittedAt) return null;

  const methodLabel = charge.offPlatformPaymentMethod
    ? OFF_PLATFORM_PAYMENT_METHOD_LABELS[charge.offPlatformPaymentMethod]
    : "Payment";
  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind];

  function approve() {
    startTransition(async () => {
      const res = await approveOutboundOffPlatformPaymentAction({
        chargeId: charge.chargeId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (!pendingReview) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted px-3 py-2">
        <p className="text-xs text-foreground">
          <span className="font-medium">Verified payment</span>
          {" · "}
          {kindLabel} · {methodLabel} · {formatUsd(charge.totalCents)}
        </p>
        <OutboundPaymentReceiptDialog
          charges={[charge]}
          customerName={customerName}
          customerEmail={customerEmail}
        />
      </div>
    );
  }

  return (
    <section className={receiptPanelClass(true)}>
      <PaymentReceiptDetails
        charge={charge}
        customerName={customerName}
        customerEmail={customerEmail}
      />
      <Button type="button" size="sm" disabled={pending} onClick={approve}>
        {pending ? "Approving…" : "Approve payment"}
      </Button>
    </section>
  );
}
