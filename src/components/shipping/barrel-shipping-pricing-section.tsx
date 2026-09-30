import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { BarrelOutboundShippingChargeCard } from "@/components/shipping/barrel-outbound-shipping-charge-card";
import { BarrelOutboundShippingPaidCard } from "@/components/shipping/barrel-outbound-shipping-paid-card";
import { ExpectedShippingChargesNotice } from "@/components/shipping/expected-shipping-charges-notice";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BarrelShippingIntakePageData } from "@/data/barrel-shipping-intake";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import {
  linkableContainersFromChargeRows,
  paidOutboundCharges,
  unpaidPublishedChargesForIntake,
} from "@/lib/barrel-outbound-shipping-charge";
import { groupShippingContainersByRateLinks } from "@/lib/shipping-container-groups";
import type { BarrelShippingIntakeSubmittedRow } from "@/lib/barrel-shipping-intake";

type BarrelShippingPricingSectionProps = {
  data: BarrelShippingIntakePageData;
  destinationCountry?: string | null;
};

function partitionSubmitted(rows: BarrelShippingIntakeSubmittedRow[]) {
  const readyToPay: BarrelShippingIntakeSubmittedRow[] = [];
  const awaitingQuote: BarrelShippingIntakeSubmittedRow[] = [];
  const paid: BarrelShippingIntakeSubmittedRow[] = [];

  for (const row of rows) {
    const unpaid = unpaidPublishedChargesForIntake(row.outboundCharges, row);
    const paidCharges = paidOutboundCharges(row.outboundCharges);
    if (paidCharges.length > 0 && unpaid.length === 0) {
      paid.push(row);
      continue;
    }
    if (unpaid.length > 0) {
      readyToPay.push(row);
      continue;
    }
    awaitingQuote.push(row);
  }

  return { readyToPay, awaitingQuote, paid };
}

function TrackingClearancePrompt() {
  return (
    <Card className="max-w-2xl border-border/80">
      <CardHeader>
        <CardTitle className="text-base">
          Confirm destination clearance first
        </CardTitle>
        <CardDescription>
          Choose broker or self-clearance and local transportation on{" "}
          <Link
            href={DASHBOARD_SHIPPING_ROUTES.tracking}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Shipment tracking
          </Link>
          . Linked unpaid containers share one confirmation there. Return here
          to pay published charges.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function BarrelShippingPricingSection({
  data,
  destinationCountry,
}: BarrelShippingPricingSectionProps) {
  const { awaiting, submitted } = data;
  const unpaidContainers = linkableContainersFromChargeRows([
    ...awaiting,
    ...submitted,
  ]);
  const groups = groupShippingContainersByRateLinks(awaiting, submitted);
  const awaitingOnlyGroups = groups.filter(
    (group) => group.awaiting.length > 0 && group.submitted.length === 0,
  );
  const payGroups = groups.filter((group) => group.submitted.length > 0);
  const submittedHostIds = new Set(
    payGroups.map((group) => {
      const host =
        group.submitted.find((row) => row.barrelId === group.chargeHost.barrelId) ??
        group.submitted[0];
      return host.intakeId;
    }),
  );
  const submittedHosts = submitted.filter((row) => submittedHostIds.has(row.intakeId));
  const { readyToPay, awaitingQuote, paid } = partitionSubmitted(submittedHosts);
  const readyGroupByIntake = new Map(
    payGroups.map((group) => {
      const host =
        group.submitted.find((row) => row.barrelId === group.chargeHost.barrelId) ??
        group.submitted[0];
      return [host.intakeId, group.members] as const;
    }),
  );
  const inCartCount = readyToPay.filter((row) =>
    unpaidPublishedChargesForIntake(row.outboundCharges, row).some((c) => c.inCart),
  ).length;
  const hasReadyContainers = awaiting.length > 0 || submitted.length > 0;

  if (!hasReadyContainers) {
    return (
      <Card className="max-w-2xl border-dashed border-border/80">
        <CardHeader>
          <CardTitle className="text-base">No containers for pricing</CardTitle>
          <CardDescription>
            After you buy a container, published freight and clearance options
            appear here. Shop containers from{" "}
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
    );
  }

  if (awaitingOnlyGroups.length > 0 && payGroups.length === 0) {
    return <TrackingClearancePrompt />;
  }

  return (
    <div className="space-y-8">
      {awaitingOnlyGroups.length > 0 ?
        <TrackingClearancePrompt />
      : payGroups.length === 0 ?
        <ExpectedShippingChargesNotice destinationCountry={destinationCountry} />
      : null}

      {readyToPay.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Pay shipping charges
            </h2>
            <p className="text-sm text-muted-foreground">
              {readyToPay.length} published charge
              {readyToPay.length === 1 ? "" : "s"}. Linked containers share one
              payment. Add freight to your cart, then checkout when ready.
            </p>
          </header>

          {inCartCount > 0 ?
            <div className="flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-primary">
                <ShoppingCart className="size-4" aria-hidden />
                {inCartCount} of {readyToPay.length} charge
                {readyToPay.length === 1 ? "" : "s"} in your cart
              </span>
              <Link
                href="/dashboard/cart"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to cart to checkout
              </Link>
            </div>
          : null}
          <ul className="flex max-w-2xl flex-col gap-4">
            {readyToPay.map((row) => (
              <li key={row.intakeId}>
                <BarrelOutboundShippingChargeCard
                  row={row}
                  members={(readyGroupByIntake.get(row.intakeId) ?? []).map(
                    (item) => ({
                      alias: item.alias,
                      intakeId:
                        "intakeId" in item ? item.intakeId : undefined,
                    }),
                  )}
                  destinationCountry={destinationCountry}
                />
              </li>
            ))}
          </ul>
        </section>
      : null}

      {awaitingQuote.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Awaiting staff quote
            </h2>
            <p className="text-sm text-muted-foreground">
              We are calculating freight, customs, and pickup charges for these
              containers. Check back soon.
            </p>
          </header>
          <ul className="flex max-w-2xl flex-col gap-3">
            {awaitingQuote.map((row) => (
              <li
                key={row.intakeId}
                className="rounded-lg border border-dashed border-border/80 bg-secondary px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">
                  {linkedGroupLabel(row, readyGroupByIntake)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Charges are being prepared. You will see freight, customs, and
                  pickup line items here when ready.
                </p>
              </li>
            ))}
          </ul>
        </section>
      : null}

      {paid.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Paid containers
            </h2>
            <p className="text-sm text-muted-foreground">
              {paid.length} payment{paid.length === 1 ? "" : "s"} received. Track
              the shipment status and download your customs clearance form below.
            </p>
          </header>
          <ul className="flex max-w-6xl flex-col gap-4">
            {paid.map((row) => (
              <li key={row.intakeId}>
                <BarrelOutboundShippingPaidCard
                  row={row}
                  members={readyGroupByIntake.get(row.intakeId)}
                  destinationCountry={destinationCountry}
                  unpaidContainers={unpaidContainers}
                />
              </li>
            ))}
          </ul>
        </section>
      : null}

      {readyToPay.length === 0 &&
      awaitingQuote.length === 0 &&
      paid.length === 0 &&
      submitted.length > 0 ?
        <p className="max-w-2xl text-sm text-muted-foreground">
          No pricing lines to show yet. Return to{" "}
          <Link
            href={DASHBOARD_SHIPPING_ROUTES.tracking}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Shipment tracking
          </Link>
          .
        </p>
      : null}
    </div>
  );
}

function linkedGroupLabel(
  row: BarrelShippingIntakeSubmittedRow,
  byIntake: Map<string, { alias: string }[]>,
) {
  const members = byIntake.get(row.intakeId);
  if (!members || members.length === 0) return `${row.alias} — ${row.slotLabel}`;
  return members.map((item) => item.alias).join(" + ");
}
