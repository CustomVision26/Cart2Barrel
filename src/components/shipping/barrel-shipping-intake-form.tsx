"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { submitBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import {
  DestinationClearanceChoices,
  isDestinationClearanceChoiceComplete,
  type DestinationClearanceChoiceValue,
} from "@/components/shipping/destination-clearance-choices";
import { ExpectedShippingChargesNotice } from "@/components/shipping/expected-shipping-charges-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Address } from "@/db/schema";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import {
  barrelShippingDeliveryMethodLabel,
  containerFullnessLabel,
  type BarrelShippingIntakeContainerRow,
} from "@/lib/barrel-shipping-intake";
import { unpaidPublishedChargesForDestination } from "@/lib/barrel-outbound-shipping-charge";
import { isOutboundChargeKindAbsorbed } from "@/lib/barrel-outbound-shipping-charge";
import {
  findDestinationBroker,
  findDestinationCourier,
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelShippingIntakeFormProps = {
  container: BarrelShippingIntakeContainerRow;
  shippingAddress: Address | undefined;
};

const EMPTY_CHOICE: DestinationClearanceChoiceValue = {
  deliveryMethod: null,
  brokerKey: null,
  courierKey: null,
};

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[8.25rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm leading-snug text-foreground">{children}</dd>
    </div>
  );
}

export function BarrelShippingIntakeForm({
  container,
  shippingAddress,
}: BarrelShippingIntakeFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [choice, setChoice] = useState<DestinationClearanceChoiceValue>(() => {
    const bundle = container.outboundCharges[0]?.chargeBundle ?? [];
    const brokerAbsorbed = isOutboundChargeKindAbsorbed("broker", bundle);
    const courierAbsorbed = isOutboundChargeKindAbsorbed("courier", bundle);
    if (!brokerAbsorbed && !courierAbsorbed) return EMPTY_CHOICE;
    return {
      deliveryMethod: brokerAbsorbed ? "broker_delivery" : null,
      brokerKey: brokerAbsorbed ? PUBLISHED_BROKER_KEY : null,
      courierKey: courierAbsorbed ? PUBLISHED_COURIER_KEY : null,
    };
  });
  const destinationCountry = shippingAddress?.country?.trim() || null;
  const chargeBundle = container.outboundCharges[0]?.chargeBundle ?? [];
  const choiceComplete =
    Boolean(destinationCountry) &&
    isDestinationClearanceChoiceComplete(choice, chargeBundle);
  const broker = findDestinationBroker(choice.brokerKey, destinationCountry);
  const courier = findDestinationCourier(choice.courierKey, destinationCountry);
  const publishedBrokerName = unpaidPublishedChargesForDestination(
    container.outboundCharges,
    destinationCountry,
    "broker",
  )[0]?.partnerName?.trim();
  const publishedCourierName = unpaidPublishedChargesForDestination(
    container.outboundCharges,
    destinationCountry,
    "courier",
  )[0]?.partnerName?.trim();
  const brokerLabel =
    choice.brokerKey === PUBLISHED_BROKER_KEY
      ? publishedBrokerName || broker?.name
      : broker?.name;
  const courierLabel =
    choice.courierKey === PUBLISHED_COURIER_KEY
      ? publishedCourierName || courier?.name
      : courier?.name;

  function submit() {
    const deliveryMethod = choice.deliveryMethod;
    if (!deliveryMethod) {
      toast.error("Choose how you will clear customs.");
      return;
    }
    if (!isDestinationClearanceChoiceComplete(choice, chargeBundle)) {
      toast.error("Choose destination clearance and local transportation.");
      return;
    }
    startTransition(async () => {
      const res = await submitBarrelShippingIntakeAction({
        barrelId: container.barrelId,
        deliveryMethod,
        brokerKey:
          choice.brokerKey ??
          (isOutboundChargeKindAbsorbed("broker", chargeBundle)
            ? PUBLISHED_BROKER_KEY
            : null),
        courierKey:
          choice.courierKey ??
          (isOutboundChargeKindAbsorbed("courier", chargeBundle)
            ? PUBLISHED_COURIER_KEY
            : null),
      });

      if (res.ok) {
        setConfirmOpen(false);
        toast.success(res.message);
        router.push(DASHBOARD_SHIPPING_ROUTES.pricing);
        router.refresh();
        return;
      }

      toast.error(res.message);
    });
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          {container.alias} — {container.slotLabel}
        </CardTitle>
        <CardDescription>
          {containerOfferingKindLabel(container.kind)} ·{" "}
          {container.itemCount} item{container.itemCount === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {containerFullnessLabel(container)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ExpectedShippingChargesNotice
          destinationCountry={destinationCountry}
          defaultOpen
          charges={container.outboundCharges}
          customsContent={
            <DestinationClearanceChoices
              destinationCountry={destinationCountry}
              namePrefix={container.barrelId}
              value={choice}
              onChange={setChoice}
              disabled={pending}
              charges={container.outboundCharges}
            />
          }
        />

        <p className="text-sm leading-relaxed text-muted-foreground">
          Select destination customs clearance and local transportation for{" "}
          {destinationCountry ?? "your destination"}, then continue to pricing
          to review published freight and related charges.
        </p>
      </CardContent>
      <CardFooter className="border-t border-border/60 pt-6">
        <Button
          type="button"
          disabled={pending || !choiceComplete}
          onClick={() => setConfirmOpen(true)}
        >
          Continue to pricing
        </Button>
      </CardFooter>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
          <DialogHeader className="gap-2 pr-8">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Confirm shipping preferences
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Please review the selections for{" "}
              <span className="font-medium text-foreground">
                {container.alias}
              </span>
              . Confirming will save these preferences and open shipping pricing.
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/80 bg-muted/40">
            <SummaryRow label="Container">
              <p className="font-medium text-foreground">{container.alias}</p>
              {container.containerName ?
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {container.containerName}
                </p>
              : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {container.slotLabel}
                {" · "}
                {containerOfferingKindLabel(container.kind)}
                {" · "}
                {containerFullnessLabel(container)}
              </p>
            </SummaryRow>
            {destinationCountry ?
              <SummaryRow label="Destination">{destinationCountry}</SummaryRow>
            : null}
            {choice.deliveryMethod ?
              <SummaryRow label="Clearance">
                {barrelShippingDeliveryMethodLabel(choice.deliveryMethod)}
              </SummaryRow>
            : null}
            {brokerLabel ?
              <SummaryRow label="Customs broker">{brokerLabel}</SummaryRow>
            : null}
            {courierLabel ?
              <SummaryRow label="Transportation">{courierLabel}</SummaryRow>
            : null}
          </dl>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !choiceComplete}
              onClick={submit}
            >
              {pending ? "Saving…" : "Confirm and continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
