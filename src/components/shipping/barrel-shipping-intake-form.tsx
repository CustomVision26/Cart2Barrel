"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  cancelBarrelShippingIntakeAction,
  submitBarrelShippingIntakeAction,
} from "@/actions/barrel-shipping-intake";
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
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import {
  destinationClearancePresentation,
  isOutboundChargeKindAbsorbed,
  type AdminRateLinkableContainer,
  unpaidPublishedChargesForDestination,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  isShippingIntakeSubmittedRow,
  linkedShippingGroupLabel,
} from "@/lib/shipping-container-groups";
import {
  findDestinationBroker,
  findDestinationCourier,
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelShippingIntakeFormProps = {
  container: BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow;
  shippingAddress: Address | undefined;
  unpaidContainers?: AdminRateLinkableContainer[];
  groupMembers?: Array<
    BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow
  >;
  preferPayHostBarrelIds?: readonly string[];
  /** Confirmed unpaid containers — Cancel can reach freight-linked siblings after cards split. */
  cancelableSubmitted?: BarrelShippingIntakeSubmittedRow[];
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

function linkedSubmittedToCancel(
  container: BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow,
  members: Array<
    BarrelShippingIntakeContainerRow | BarrelShippingIntakeSubmittedRow
  >,
  cancelableSubmitted: readonly BarrelShippingIntakeSubmittedRow[],
): BarrelShippingIntakeSubmittedRow[] {
  const barrelIds = new Set(members.map((row) => row.barrelId));
  barrelIds.add(container.barrelId);
  for (const charge of container.outboundCharges) {
    for (const item of charge.linkedContainers ?? []) {
      if (item.barrelId) barrelIds.add(item.barrelId);
    }
  }
  const found: BarrelShippingIntakeSubmittedRow[] = [];
  const seen = new Set<string>();
  function add(row: BarrelShippingIntakeSubmittedRow) {
    if (seen.has(row.intakeId)) return;
    seen.add(row.intakeId);
    found.push(row);
  }
  for (const row of members) {
    if (isShippingIntakeSubmittedRow(row)) add(row);
  }
  for (const row of cancelableSubmitted) {
    if (barrelIds.has(row.barrelId)) add(row);
  }
  return found;
}

export function BarrelShippingIntakeForm({
  container,
  shippingAddress,
  unpaidContainers = [],
  groupMembers,
  preferPayHostBarrelIds,
  cancelableSubmitted = [],
}: BarrelShippingIntakeFormProps) {
  const members =
    groupMembers && groupMembers.length > 0 ? groupMembers : [container];
  const groupLabel = linkedShippingGroupLabel(members);
  const itemCount = members.reduce((sum, row) => sum + row.itemCount, 0);
  const awaitingMembers = members.filter(
    (row) => !isShippingIntakeSubmittedRow(row),
  );
  const hasUnpaidAwaiting = awaitingMembers.length > 0;
  const alreadyConfirmed = !hasUnpaidAwaiting;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [choice, setChoice] = useState<DestinationClearanceChoiceValue>(() => {
    if (isShippingIntakeSubmittedRow(container) && !hasUnpaidAwaiting) {
      return {
        deliveryMethod: container.deliveryMethod,
        brokerKey: container.selectedBrokerKey,
        courierKey: container.selectedCourierKey,
      };
    }
    const presentation = destinationClearancePresentation(
      container.outboundCharges,
      shippingAddress?.country?.trim() || null,
    );
    return {
      deliveryMethod: presentation.brokerAbsorbed ? "broker_delivery" : null,
      brokerKey: presentation.brokerAbsorbed ? PUBLISHED_BROKER_KEY : null,
      courierKey:
        presentation.courierAbsorbed || presentation.publishedCouriers.length > 0
          ? PUBLISHED_COURIER_KEY
          : null,
    };
  });
  const destinationCountry = shippingAddress?.country?.trim() || null;
  const chargeBundle = container.outboundCharges[0]?.chargeBundle ?? [];
  const clearance = destinationClearancePresentation(
    container.outboundCharges,
    destinationCountry,
  );
  const choiceComplete =
    Boolean(destinationCountry) &&
    isDestinationClearanceChoiceComplete(
      choice,
      container.outboundCharges,
      destinationCountry,
    );
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
    const deliveryMethod =
      choice.deliveryMethod ??
      (clearance.brokerAbsorbed ? "broker_delivery" : null);
    if (!deliveryMethod) {
      toast.error("Choose how you will clear customs.");
      return;
    }
    if (!isDestinationClearanceChoiceComplete(choice, container.outboundCharges, destinationCountry)) {
      toast.error("Choose destination clearance and local transportation.");
      return;
    }
    startTransition(async () => {
      const res = await submitBarrelShippingIntakeAction({
        barrelId: container.barrelId,
        alsoConfirmBarrelIds: awaitingMembers
          .map((row) => row.barrelId)
          .filter((id) => id !== container.barrelId),
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

  function cancelSubmit() {
    const [first, ...rest] = linkedSubmittedToCancel(
      container,
      members,
      cancelableSubmitted,
    );
    if (!first) {
      toast.error(
        "No confirmation to cancel. Continue to pricing first if this container is still open.",
      );
      return;
    }
    startTransition(async () => {
      const res = await cancelBarrelShippingIntakeAction({
        intakeId: first.intakeId,
        alsoIntakeIds: rest.map((row) => row.intakeId),
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
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          {groupLabel} — {container.slotLabel}
        </CardTitle>
        <CardDescription>
          {containerOfferingKindLabel(container.kind)} ·{" "}
          {itemCount} item{itemCount === 1 ? "" : "s"}
          {members.length > 1 ?
            <>
              {" · "}
              {members.length} linked containers
            </>
          : null}{" "}
          ·{" "}
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
          sourceBarrelId={container.barrelId}
          unpaidContainers={unpaidContainers}
          preferPayHostBarrelIds={preferPayHostBarrelIds}
          customsContent={
            <DestinationClearanceChoices
              destinationCountry={destinationCountry}
              namePrefix={container.barrelId}
              value={choice}
              onChange={setChoice}
              disabled={pending || alreadyConfirmed}
              linkDisabled={pending}
              charges={container.outboundCharges}
              sourceBarrelId={container.barrelId}
              unpaidContainers={unpaidContainers}
              preferPayHostBarrelIds={preferPayHostBarrelIds}
            />
          }
        />

        <p className="text-sm leading-relaxed text-muted-foreground">
          Review destination clearance for{" "}
          {destinationCountry ?? "your destination"}, then continue to pricing
          to add published freight and related charges.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={cancelSubmit}
        >
          {pending ? "Cancelling…" : "Cancel confirmation"}
        </Button>
        <Button
          type="button"
          disabled={pending || (hasUnpaidAwaiting && !choiceComplete)}
          onClick={() => {
            if (hasUnpaidAwaiting) {
              setConfirmOpen(true);
              return;
            }
            router.push(DASHBOARD_SHIPPING_ROUTES.pricing);
          }}
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
              <span className="font-medium text-foreground">{groupLabel}</span>
              . Confirming will save these preferences
              {members.length > 1 ? " for every linked container" : ""} and open
              shipping pricing.
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/80 bg-muted/40">
            <SummaryRow label={members.length > 1 ? "Containers" : "Container"}>
              {members.map((row) => (
                <div key={row.barrelId} className={members[0] === row ? undefined : "mt-2"}>
                  <p className="font-medium text-foreground">{row.alias}</p>
                  {row.containerName ?
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {row.containerName}
                    </p>
                  : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.slotLabel}
                    {" · "}
                    {containerOfferingKindLabel(row.kind)}
                    {" · "}
                    {containerFullnessLabel(row)}
                  </p>
                </div>
              ))}
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
