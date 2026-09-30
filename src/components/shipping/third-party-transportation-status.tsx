"use client";

import { describeThirdPartyTransportation } from "@/lib/barrel-shipping-intake";
import { isBeforePickedUpShipmentStage } from "@/lib/barrel-shipment-tracking";
import type { BarrelOutboundShipmentStage } from "@/lib/barrel-shipment-tracking";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

import { OutboundChargePaymentStatus } from "@/components/shipping/outbound-charge-payment-status";

export function ThirdPartyTransportationStatus({
  selectedCourierKey,
  outboundCharges,
  trackingStage,
  className,
  audience = "dashboard",
  customerName,
  customerEmail,
  showCustomer = false,
}: {
  selectedCourierKey?: string | null;
  outboundCharges: readonly BarrelOutboundShippingChargeView[];
  trackingStage?: BarrelOutboundShipmentStage | null;
  className?: string;
  audience?: "dashboard" | "customer" | "admin";
  customerName?: string | null;
  customerEmail?: string | null;
  showCustomer?: boolean;
}) {
  if (!isBeforePickedUpShipmentStage(trackingStage)) {
    return null;
  }
  const status = describeThirdPartyTransportation({
    selectedCourierKey,
    outboundCharges,
  });
  const courierCharge = outboundCharges.find(
    (charge) => charge.chargeKind === "courier",
  );
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs text-foreground",
        status.kind === "added"
          ? status.paid
            ? "border-emerald-500/30 bg-emerald-500/10"
            : status.pendingReview
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-primary/30 bg-primary/10"
          : "border-border/70 bg-muted/50",
        className,
      )}
    >
      <p>
        <span className="font-medium">Local transportation: </span>
        {status.summary}
      </p>
      {courierCharge ?
        <OutboundChargePaymentStatus
          charges={[courierCharge]}
          audience={audience}
          customerName={customerName}
          customerEmail={customerEmail}
          showCustomer={showCustomer}
        />
      : null}
    </div>
  );
}
