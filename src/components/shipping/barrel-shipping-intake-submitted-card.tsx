"use client";

import { ChevronDownIcon, MapPinIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import { BarrelContentsPreviewDialog } from "@/components/shipping/barrel-contents-preview-dialog";
import { OutboundShippingAddedChargesPanel } from "@/components/shipping/outbound-shipping-added-charges-panel";
import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { CustomsClearanceDocumentsPanel } from "@/components/shipping/customs-clearance-documents-panel";
import {
  OverseasVendorPreferenceSummary,
  ThirdPartyVendorsDivider,
  ThirdPartyVendorsSection,
} from "@/components/shipping/third-party-vendors-section";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  hasCustomsClearanceInfo,
  type BarrelOutboundShipmentTrackingView,
} from "@/lib/barrel-shipment-tracking";
import {
  canCancelShippingIntake,
  containerFullnessLabel,
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import {
  paidOutboundCharges,
  unpaidPublishedChargesForIntake,
} from "@/lib/barrel-outbound-shipping-charge";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";
import { formatShippingDestinationLines } from "@/lib/shipping-address-format";
import type { Address } from "@/db/schema";

function currentStageLabel(
  tracking: BarrelOutboundShipmentTrackingView | null,
): string {
  const stage = tracking?.trackingStage ?? "awaiting_customs_clearance";
  return BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[stage];
}

type BarrelShippingIntakeSubmittedCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
  shippingAddress?: Address | null;
};

export function BarrelShippingIntakeSubmittedCard({
  row,
  shippingAddress,
}: BarrelShippingIntakeSubmittedCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const unpaid = unpaidPublishedChargesForIntake(row.outboundCharges, row);
  const paid = paidOutboundCharges(row.outboundCharges);
  const trackingCharge = paid[0] ?? row.outboundCharges[0] ?? null;
  const destinationLines =
    shippingAddress ? formatShippingDestinationLines(shippingAddress) : [];
  const destinationCountry = shippingAddress?.country?.trim() || null;

  const freightPaid = row.outboundCharges.some(
    (charge) => charge.chargeKind === "freight" && Boolean(charge.paidAt),
  );
  const canCancel = canCancelShippingIntake(row);

  function cancelSubmit() {
    startTransition(async () => {
      const res = await cancelBarrelShippingIntakeAction({
        intakeId: row.intakeId,
      });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
        return;
      }
      toast.error(res.message);
    });
  }

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <CardContent className="p-3">
        <article className="flex gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="aspect-square self-start rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {row.containerName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {row.alias} · {containerOfferingKindLabel(row.kind)} ·{" "}
                  {containerFullnessLabel(row)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirmed{" "}
                  {new Date(row.submittedAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <BarrelContentsPreviewDialog
                barrelId={row.barrelId}
                containerLabel={row.containerName}
                containerAlias={row.alias}
                items={row.contents}
              />
            </div>

            {destinationLines.length > 0 ?
              <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted px-2.5 py-2 text-xs">
                <MapPinIcon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Destination</p>
                  <address className="not-italic text-muted-foreground">
                    {destinationLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              </div>
            : null}

            <ThirdPartyVendorsDivider />
            <div
              className={
                unpaid.length > 0
                  ? "grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.85fr)]"
                  : undefined
              }
            >
              <ThirdPartyVendorsSection
                charges={row.outboundCharges}
                showDivider={false}
                intake={row}
                overseasSummary={
                  <OverseasVendorPreferenceSummary
                    row={row}
                    destinationCountry={destinationCountry}
                  />
                }
              />
              {unpaid.length > 0 ?
                <OutboundShippingAddedChargesPanel charges={unpaid} />
              : null}
            </div>

            {paid.length > 0 ?
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Current status:{" "}
                    <span className="font-medium text-foreground">
                      {currentStageLabel(trackingCharge?.shipmentTracking ?? null)}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? "Hide details" : "Tracking details"}
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </Button>
                </div>

                <CustomsClearanceDocumentsPanel
                  barrelId={row.barrelId}
                  published={hasCustomsClearanceInfo({
                    customsDeclarationFormUrl:
                      trackingCharge?.shipmentTracking
                        ?.customsDeclarationFormUrl ?? null,
                    freightCompanyName:
                      trackingCharge?.shipmentTracking
                        ?.freightCompanyName ?? null,
                  })}
                  customsFormUrl={
                    trackingCharge?.shipmentTracking?.customsDeclarationFormUrl
                  }
                  containerName={row.containerName}
                />

                {expanded ?
                  <BarrelShipmentTrackingTimeline
                    tracking={trackingCharge?.shipmentTracking ?? null}
                    paidAt={trackingCharge?.paidAt ?? null}
                    paymentReferenceNumber={
                      trackingCharge?.paymentReferenceNumber ?? null
                    }
                    compact
                    showCustomsForm={false}
                  />
                : null}
              </div>
            : unpaid.length > 0 ?
              <p className="text-xs text-muted-foreground">
                Add freight to your cart above. Pay broker and local courier
                charges with Zelle, Cash App, or at the local office.
              </p>
            : null}
          </div>
        </article>
      </CardContent>
      {canCancel ?
        <CardFooter className="flex flex-col items-start gap-1.5 border-t border-border/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={cancelSubmit}
          >
            {pending ? "Cancelling…" : "Cancel confirmation"}
          </Button>
          {freightPaid ?
            <p className="text-[11px] text-muted-foreground">
              Freight payment stays on this container. Broker and local courier
              receipts will need to be submitted again after you reconfirm.
            </p>
          : null}
        </CardFooter>
      : null}
    </Card>
  );
}
