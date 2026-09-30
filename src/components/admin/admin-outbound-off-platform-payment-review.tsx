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
import { PaidVendorBadge, SubmittedPaymentBadge } from "@/components/shipping/outbound-charge-payment-status";
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

export function AdminOutboundOffPlatformPaymentReview({
  charge,
  customerName,
  customerEmail,
}: ReceiptChargeProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingReview = isOffPlatformPaymentPendingReview(charge);
  if (!pendingReview && !charge.offPlatformSubmittedAt && !charge.offPlatformReceiptUrl) {
    return null;
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-1.5 text-xs leading-snug text-foreground">
          <PaidVendorBadge />
          <span>
            {kindLabel} · {methodLabel} · {formatUsd(charge.totalCents)}
          </span>
        </p>
        <OutboundPaymentReceiptDialog
          charges={[charge]}
          customerName={customerName}
          customerEmail={customerEmail}
          triggerLabel="View receipt"
          triggerSize="xs"
        />
      </div>
    );
  }

  return (
    <section className={receiptPanelClass(true)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SubmittedPaymentBadge />
          <p className="text-xs font-medium text-foreground">
            {kindLabel} payment submitted
          </p>
        </div>
        <OutboundPaymentReceiptDialog
          charges={[charge]}
          customerName={customerName}
          customerEmail={customerEmail}
          triggerLabel="View receipt"
          triggerSize="xs"
        />
      </div>
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
