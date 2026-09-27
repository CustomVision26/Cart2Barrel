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
  const [choice, setChoice] = useState<DestinationClearanceChoiceValue>({
    deliveryMethod: row.deliveryMethod,
    brokerKey: row.selectedBrokerKey,
    courierKey: row.selectedCourierKey,
  });

  function persist(next: DestinationClearanceChoiceValue) {
    setChoice(next);
    if (!isDestinationClearanceChoiceComplete(next, row.outboundCharges[0]?.chargeBundle ?? []) || !next.deliveryMethod) {
      return;
    }
    startTransition(async () => {
      const res = await updateBarrelShippingIntakeAction({
        intakeId: row.intakeId,
        deliveryMethod: next.deliveryMethod,
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

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <p className="text-xs font-medium text-foreground">
        Destination customs clearance
      </p>
      <p className="text-[11px] text-muted-foreground">
        Freight is paid. You can still choose to clear customs yourself or use a
        selected broker, then arrange local transportation.
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
