"use client";

import { CheckCircle2Icon } from "lucide-react";

import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { CustomsClearanceForm } from "@/components/shipping/customs-clearance-form";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  type BarrelOutboundShipmentTrackingView,
} from "@/lib/barrel-shipment-tracking";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";
import { containerFullnessLabel } from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelOutboundShippingPaidCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
};

function currentStageLabel(
  tracking: BarrelOutboundShipmentTrackingView | null,
): string {
  const stage = tracking?.trackingStage ?? "awaiting_customs_clearance";
  return BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[stage];
}

export function BarrelOutboundShippingPaidCard({
  row,
}: BarrelOutboundShippingPaidCardProps) {
  const charge = row.outboundCharge;
  if (!charge?.paidAt) {
    return null;
  }

  const tracking = charge.shipmentTracking;
  const customsFormUrl = tracking?.customsDeclarationFormUrl?.trim() || null;

  return (
    <Card className="overflow-hidden border-emerald-500/30 bg-card shadow-sm">
      <CardContent className="space-y-3 p-3">
        <article className="flex gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="aspect-square self-start rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {row.containerName}
              </h3>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3" aria-hidden />
                Paid
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.alias} · {containerOfferingKindLabel(row.kind)} ·{" "}
              {containerFullnessLabel(row)}
            </p>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Total paid {formatUsd(charge.totalCents)}
              {charge.paidAt ?
                <span className="ml-1 font-normal">
                  on{" "}
                  {new Date(charge.paidAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              : null}
            </p>
            <p className="text-xs text-muted-foreground">
              Current status:{" "}
              <span className="font-medium text-foreground">
                {currentStageLabel(tracking)}
              </span>
            </p>
          </div>
        </article>

        <div className="border-t border-border/60 pt-3">
          <BarrelShipmentTrackingTimeline
            tracking={tracking}
            paidAt={charge.paidAt}
            paymentReferenceNumber={charge.paymentReferenceNumber}
            compact
            showCustomsForm={false}
          />
        </div>

        <div className="border-t border-border/60 pt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">
            Customs clearance form
          </p>
          {customsFormUrl ?
            <CustomsClearanceForm
              url={customsFormUrl}
              containerName={row.containerName}
            />
          : <p className="text-xs text-muted-foreground">
              Your customs clearance form will appear here once our team uploads
              it.
            </p>
          }
        </div>
      </CardContent>
    </Card>
  );
}
