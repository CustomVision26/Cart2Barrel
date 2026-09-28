"use client";

import { CheckCircle2Icon } from "lucide-react";

import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { CustomsClearanceDocumentsPanel } from "@/components/shipping/customs-clearance-documents-panel";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { BarrelContentsPreviewDialog } from "@/components/shipping/barrel-contents-preview-dialog";
import { PaidContainerClearanceChoices } from "@/components/shipping/paid-container-clearance-choices";
import { OutboundShippingRefundButton } from "@/components/shipping/outbound-shipping-refund-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  outboundShippingRefundPath,
  paidOutboundCharges,
} from "@/lib/barrel-outbound-shipping-charge";
import { formatUsd } from "@/lib/admin-markup";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  hasCustomsClearanceInfo,
  type BarrelOutboundShipmentTrackingView,
} from "@/lib/barrel-shipment-tracking";
import {
  containerFullnessLabel,
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import { linkedShippingGroupLabel } from "@/lib/shipping-container-groups";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelOutboundShippingPaidCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
  members?: { alias: string }[];
  destinationCountry?: string | null;
};

function currentStageLabel(
  tracking: BarrelOutboundShipmentTrackingView | null,
): string {
  const stage = tracking?.trackingStage ?? "awaiting_customs_clearance";
  return BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[stage];
}

export function BarrelOutboundShippingPaidCard({
  row,
  members,
  destinationCountry,
}: BarrelOutboundShippingPaidCardProps) {
  const group = members && members.length > 0 ? members : [row];
  const groupLabel = linkedShippingGroupLabel(group);
  const paid = paidOutboundCharges(row.outboundCharges);
  const charge = paid[0] ?? null;
  if (!charge?.paidAt) {
    return null;
  }
  const paidTotal = paid.reduce((s, c) => s + c.totalCents, 0);
  const amaniCharges = paid.filter(
    (item) => outboundShippingRefundPath(item) === "amani",
  );
  const amaniHost =
    amaniCharges.find((item) => item.chargeKind === "freight") ??
    amaniCharges[0] ??
    null;

  const tracking = charge.shipmentTracking;
  const customsFormUrl = tracking?.customsDeclarationFormUrl?.trim() || null;
  const packPublished = hasCustomsClearanceInfo({
    customsDeclarationFormUrl: customsFormUrl,
    freightCompanyName: tracking?.freightCompanyName ?? null,
  });

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
              <div className="flex shrink-0 items-center gap-2">
                <BarrelContentsPreviewDialog
                  barrelId={row.barrelId}
                  containerLabel={row.containerName}
                  containerAlias={row.alias}
                  items={row.contents}
                />
                {amaniHost ?
                  <OutboundShippingRefundButton
                    charge={amaniHost}
                    relatedCharges={amaniCharges}
                  />
                : null}
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-3" aria-hidden />
                  Paid
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {groupLabel} · {containerOfferingKindLabel(row.kind)} ·{" "}
              {containerFullnessLabel(row)}
            </p>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Total paid {formatUsd(paidTotal)}
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

        <PaidContainerClearanceChoices
          row={row}
          destinationCountry={destinationCountry}
        />

        <CustomsClearanceDocumentsPanel
          barrelId={row.barrelId}
          published={packPublished}
          customsFormUrl={customsFormUrl}
          containerName={row.containerName}
        />
      </CardContent>
    </Card>
  );
}
