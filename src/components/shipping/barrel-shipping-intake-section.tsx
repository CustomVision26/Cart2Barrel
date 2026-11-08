import Link from "next/link";

import { IllustrationCargoShip } from "@/components/brand/amani-illustrations";
import { CustomerEmptyState } from "@/components/dashboard/customer-empty-state";
import { BarrelShippingIntakeForm } from "@/components/shipping/barrel-shipping-intake-form";
import { BarrelShippingIntakeSubmittedCard } from "@/components/shipping/barrel-shipping-intake-submitted-card";
import type { BarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";
import type { Address } from "@/db/schema";
import { linkableContainersFromChargeRows } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  type BarrelOutboundShipmentStage,
} from "@/lib/barrel-shipment-tracking";
import {
  compareShippingIntakeTrackingStage,
  shippingIntakeHasPaidOutbound,
  shippingIntakeTrackingStage,
  toPaidShippingTrackingRow,
} from "@/lib/barrel-shipping-intake";
import {
  groupShippingContainersByRateLinks,
  isShippingIntakeSubmittedRow,
} from "@/lib/shipping-container-groups";

type BarrelShippingIntakeSectionProps = {
  data: BarrelShippingIntakePageData;
  shippingAddress: Address | undefined;
  shippingAddressComplete: boolean;
};

export function BarrelShippingIntakeSection({
  data,
  shippingAddress,
  shippingAddressComplete: _shippingAddressComplete,
}: BarrelShippingIntakeSectionProps) {
  const { awaiting, submitted } = data;
  const unpaidContainers = linkableContainersFromChargeRows([
    ...awaiting,
    ...submitted,
  ]);
  const preferPayHostBarrelIds = awaiting.map((row) => row.barrelId);
  const groups = groupShippingContainersByRateLinks(awaiting, submitted, {
    splitUnlinkedStandalone: true,
  });
  const unpaidGroups = groups
    .map((group) => {
      const unpaidMembers = group.members.filter(
        (row) => !shippingIntakeHasPaidOutbound(row),
      );
      const unpaidAwaiting = group.awaiting.filter(
        (row) => !shippingIntakeHasPaidOutbound(row),
      );
      const unpaidSubmitted = group.submitted.filter(
        (row) => !shippingIntakeHasPaidOutbound(row),
      );
      return {
        ...group,
        members: unpaidMembers,
        awaiting: unpaidAwaiting,
        submitted: unpaidSubmitted,
        barrelIds: unpaidMembers.map((row) => row.barrelId),
      };
    })
    .filter((group) => group.members.length > 0);
  const trackingByStage = new Map<
    BarrelOutboundShipmentStage,
    ReturnType<typeof toPaidShippingTrackingRow>[]
  >();
  for (const row of [...awaiting, ...submitted]
    .filter(shippingIntakeHasPaidOutbound)
    .map(toPaidShippingTrackingRow)) {
    const stage = shippingIntakeTrackingStage(row);
    const list = trackingByStage.get(stage) ?? [];
    list.push(row);
    trackingByStage.set(stage, list);
  }
  const trackingStages = [...trackingByStage.keys()].sort(
    compareShippingIntakeTrackingStage,
  );

  return (
    <div className="space-y-8">
      {trackingStages.map((stage) => {
        return (
          <section key={stage} className="space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[stage]}
              </h2>
              <p className="text-sm text-muted-foreground">
                Freight is paid. This heading is the container&apos;s current
                shipment stage.
              </p>
            </header>
            <ul className="flex max-w-6xl flex-col gap-6">
              {(trackingByStage.get(stage) ?? []).map((row) => (
                <li key={row.barrelId}>
                  <BarrelShippingIntakeSubmittedCard
                    row={row}
                    members={[row]}
                    shippingAddress={shippingAddress}
                    unpaidContainers={unpaidContainers}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {unpaidGroups.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Outbound shipping charges
            </h2>
            <p className="text-sm text-muted-foreground">
              {unpaidGroups.length} charge
              {unpaidGroups.length === 1 ? "" : "s"} on this account. Containers
              that share freight and the same local courier appear on one card.
              Unlinking courier keeps a separate card. Only one Add to cart
              shows for a joint freight amount.
            </p>
          </header>

          <div className="flex max-w-6xl flex-col gap-6">
            {unpaidGroups.map((group) => {
              const host =
                group.members.find(
                  (row) => !isShippingIntakeSubmittedRow(row),
                ) ??
                group.members[0] ??
                group.chargeHost;
              return (
                <BarrelShippingIntakeForm
                  key={group.barrelIds.join(":")}
                  container={host}
                  groupMembers={group.members}
                  shippingAddress={shippingAddress}
                  unpaidContainers={unpaidContainers}
                  preferPayHostBarrelIds={preferPayHostBarrelIds}
                  cancelableSubmitted={submitted.filter(
                    (row) => !shippingIntakeHasPaidOutbound(row),
                  )}
                />
              );
            })}
          </div>
        </section>
      : null}

      {unpaidGroups.length === 0 &&
      submitted.length === 0 &&
      trackingStages.length === 0 ?
        <CustomerEmptyState
          title="No containers yet."
          description="You don’t have any containers in transit right now. Browse available containers to start a shipment."
          illustration={<IllustrationCargoShip />}
          actions={
            <Link
              href="/dashboard/barrels"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Browse Containers
            </Link>
          }
        />
      : null}
    </div>
  );
}
