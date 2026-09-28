"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import {
  DestinationClearanceChoices,
  isDestinationClearanceChoiceComplete,
  type DestinationClearanceChoiceValue,
} from "@/components/shipping/destination-clearance-choices";
import { destinationClearancePresentation } from "@/lib/barrel-outbound-shipping-charge";
import {
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";

export function PaidContainerClearanceChoices({
  row,
  destinationCountry,
}: {
  row: BarrelShippingIntakeSubmittedRow;
  destinationCountry?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<DestinationClearanceChoiceValue>(() => {
    const presentation = destinationClearancePresentation(
      row.outboundCharges,
      destinationCountry,
    );
    return {
      deliveryMethod: presentation.brokerAbsorbed
        ? "broker_delivery"
        : row.deliveryMethod,
      brokerKey: presentation.brokerAbsorbed
        ? PUBLISHED_BROKER_KEY
        : row.selectedBrokerKey,
      courierKey: presentation.courierAbsorbed
        ? PUBLISHED_COURIER_KEY
        : row.selectedCourierKey,
    };
  });

  const presentation = destinationClearancePresentation(
    row.outboundCharges,
    destinationCountry,
  );

  function persist(next: DestinationClearanceChoiceValue) {
    setChoice(next);
    if (
      !isDestinationClearanceChoiceComplete(
        next,
        row.outboundCharges,
        destinationCountry,
      )
    ) {
      return;
    }
    const deliveryMethod =
      next.deliveryMethod ??
      (presentation.brokerAbsorbed ? "broker_delivery" : null);
    if (!deliveryMethod) return;
    startTransition(async () => {
      const res = await updateBarrelShippingIntakeAction({
        intakeId: row.intakeId,
        deliveryMethod,
        brokerKey: next.brokerKey,
        courierKey: next.courierKey,
      });
      if (!res.ok) {
        toast.error(res.message);
        setChoice({
          deliveryMethod: row.deliveryMethod,
          brokerKey: row.selectedBrokerKey,
          courierKey: row.selectedCourierKey,
        });
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (!presentation.showBrokerUi && !presentation.showCourierUi) {
    return null;
  }

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <p className="text-xs font-medium text-foreground">
        Destination customs clearance
      </p>
      <p className="text-[11px] text-muted-foreground">
        {presentation.showBrokerUi
          ? "Freight is paid. You can still choose to clear customs yourself or use a selected broker."
          : "Freight is paid. Destination customs is included with freight."}
        {presentation.showCourierUi
          ? " You can still choose a published courier or provide your own transportation."
          : ""}
      </p>
      <DestinationClearanceChoices
        destinationCountry={destinationCountry}
        namePrefix={`${row.barrelId}-paid`}
        value={choice}
        onChange={persist}
        disabled={pending}
        charges={row.outboundCharges}
      />
    </div>
  );
}
