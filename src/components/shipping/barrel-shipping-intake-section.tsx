import Link from "next/link";

import { BarrelShippingIntakeForm } from "@/components/shipping/barrel-shipping-intake-form";
import { BarrelShippingIntakeSubmittedCard } from "@/components/shipping/barrel-shipping-intake-submitted-card";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";
import type { Address } from "@/db/schema";
import { linkableContainersFromChargeRows } from "@/lib/barrel-outbound-shipping-charge";
import { groupShippingContainersByRateLinks } from "@/lib/shipping-container-groups";

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
  const groups = groupShippingContainersByRateLinks(awaiting, submitted);
  const intakeGroups = groups.filter((group) => group.awaiting.length > 0);
  const submittedGroups = groups.filter(
    (group) => group.awaiting.length === 0 && group.submitted.length > 0,
  );

  return (
    <div className="space-y-8">
      {intakeGroups.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Outbound shipping charges
            </h2>
            <p className="text-sm text-muted-foreground">
              {intakeGroups.length} group
              {intakeGroups.length === 1 ? "" : "s"} on this account. Linked
              freight, broker, or courier charges share one confirmation below.
            </p>
          </header>

          <div className="flex max-w-6xl flex-col gap-6">
            {intakeGroups.map((group) => {
              const host =
                group.awaiting.find(
                  (row) => row.barrelId === group.chargeHost.barrelId,
                ) ?? group.awaiting[0];
              return (
                <BarrelShippingIntakeForm
                  key={group.barrelIds.join(":")}
                  container={host}
                  shippingAddress={shippingAddress}
                  unpaidContainers={unpaidContainers}
                  groupMembers={group.members}
                />
              );
            })}
          </div>
        </section>
      : null}

      {submittedGroups.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Ready for pricing
            </h2>
            <p className="text-sm text-muted-foreground">
              We received your confirmation. Pay freight, customs, and pickup
              charges on the{" "}
              <Link
                href={DASHBOARD_SHIPPING_ROUTES.pricing}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Pricing
              </Link>{" "}
              tab. After freight is paid, shipment tracking and customs updates
              appear here.
            </p>
          </header>

          <ul className="flex max-w-6xl flex-col gap-6">
            {submittedGroups.map((group) => {
              const host = group.submitted.find(
                (row) => row.barrelId === group.chargeHost.barrelId,
              ) ?? group.submitted[0];
              return (
                <li key={group.barrelIds.join(":")}>
                  <BarrelShippingIntakeSubmittedCard
                    row={host}
                    members={group.submitted}
                    shippingAddress={shippingAddress}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      : null}

      {awaiting.length === 0 && submitted.length === 0 ?
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
