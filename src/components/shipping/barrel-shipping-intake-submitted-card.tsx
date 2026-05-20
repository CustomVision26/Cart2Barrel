"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cancelBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";
import { containerFullnessLabel } from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelShippingIntakeSubmittedCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
};

export function BarrelShippingIntakeSubmittedCard({
  row,
}: BarrelShippingIntakeSubmittedCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const charge = row.outboundCharge;

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
            className="rounded-md ring-1 ring-border/40"
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

            {charge?.paidAt ?
              <BarrelShipmentTrackingTimeline
                tracking={charge.shipmentTracking}
                paidAt={charge.paidAt}
                paymentReferenceNumber={charge.paymentReferenceNumber}
                compact
              />
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
