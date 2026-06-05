"use client";

import { ChevronDownIcon, MapPinIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { CustomsClearanceForm } from "@/components/shipping/customs-clearance-form";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  type BarrelOutboundShipmentTrackingView,
} from "@/lib/barrel-shipment-tracking";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";
import { containerFullnessLabel } from "@/lib/barrel-shipping-intake";
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
  const charge = row.outboundCharge;
  const destinationLines =
    shippingAddress ? formatShippingDestinationLines(shippingAddress) : [];

  const canCancel =
    row.status !== "shipped" && row.status !== "delivered" && !charge?.paidAt;

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
            <div>
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

            {charge?.paidAt ?
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Current status:{" "}
                    <span className="font-medium text-foreground">
                      {currentStageLabel(charge.shipmentTracking)}
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

                {expanded ?
                  <div className="space-y-3">
                    <BarrelShipmentTrackingTimeline
                      tracking={charge.shipmentTracking}
                      paidAt={charge.paidAt}
                      paymentReferenceNumber={charge.paymentReferenceNumber}
                      compact
                      showCustomsForm={false}
                    />
                    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted px-2.5 py-2">
                      <p className="text-[11px] font-medium text-foreground">
                        Customs clearance form
                      </p>
                      {charge.shipmentTracking?.customsDeclarationFormUrl?.trim() ?
                        <CustomsClearanceForm
                          url={charge.shipmentTracking.customsDeclarationFormUrl}
                          containerName={row.containerName}
                        />
                      : <p className="text-[11px] text-muted-foreground">
                          Your customs clearance form will appear here once our
                          team uploads it.
                        </p>
                      }
                    </div>
                  </div>
                : null}
              </div>
            : charge && charge.totalCents > 0 && !charge.paidAt ?
              <p className="text-xs text-muted-foreground">
                Charges published — pay on the Pricing tab when ready.
              </p>
            : null}
          </div>
        </article>
      </CardContent>
      {canCancel ?
        <CardFooter className="border-t border-border/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={cancelSubmit}
          >
            {pending ? "Cancelling…" : "Cancel confirmation"}
          </Button>
        </CardFooter>
      : null}
    </Card>
  );
}
