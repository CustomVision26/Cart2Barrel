import Link from "next/link";

import { BarrelShippingIntakeForm } from "@/components/shipping/barrel-shipping-intake-form";
import { BarrelShippingIntakeSubmittedCard } from "@/components/shipping/barrel-shipping-intake-submitted-card";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    typeof submitted
  >();
  for (const row of submitted.filter(shippingIntakeHasPaidOutbound)) {
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
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {unpaidGroups.length === 0 && submitted.length === 0 ?
        <Card className="max-w-2xl border-dashed border-border/80">
          <CardHeader>
            <CardTitle className="text-base">No containers yet</CardTitle>
            <CardDescription>
              After you buy a container, freight, customs clearance, and pickup
              options appear here. Shop containers from{" "}
              <Link
                href="/dashboard/barrels"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                My containers
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      : null}
    </div>
  );
}
