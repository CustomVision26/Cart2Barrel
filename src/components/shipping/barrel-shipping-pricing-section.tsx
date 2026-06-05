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
    const charge = row.outboundCharge;
    if (charge?.paidAt) {
      paid.push(row);
      continue;
    }
    if (charge && charge.totalCents > 0) {
      readyToPay.push(row);
      continue;
    }
    awaitingQuote.push(row);
  }

  return { readyToPay, awaitingQuote, paid };
}

export function BarrelShippingPricingSection({
  data,
  destinationCountry,
}: BarrelShippingPricingSectionProps) {
  const { awaiting, submitted } = data;
  const { readyToPay, awaitingQuote, paid } = partitionSubmitted(submitted);
  const inCartCount = readyToPay.filter(
    (row) => row.outboundCharge?.inCart,
  ).length;
  const hasReadyContainers = awaiting.length > 0 || submitted.length > 0;

  if (!hasReadyContainers) {
    return (
      <Card className="max-w-2xl border-dashed border-border/80">
        <CardHeader>
          <CardTitle className="text-base">No containers ready for pricing</CardTitle>
          <CardDescription>
            When a container reaches 100% load or is marked full, shipping charges
            appear here. Pack items in{" "}
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

  if (awaiting.length > 0 && submitted.length === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <ExpectedShippingChargesNotice destinationCountry={destinationCountry} />
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Submit preferences first</CardTitle>
            <CardDescription>
              You have {awaiting.length} full container
              {awaiting.length === 1 ? "" : "s"} not yet confirmed for pricing.{" "}
              <Link
                href={DASHBOARD_SHIPPING_ROUTES.tracking}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to Shipment tracking
              </Link>{" "}
              to mark it ready for shipping charges. Pricing amounts appear here
              after you continue from Shipment tracking.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ExpectedShippingChargesNotice destinationCountry={destinationCountry} />

      {readyToPay.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Pay shipping charges
            </h2>
            <p className="text-sm text-muted-foreground">
              {readyToPay.length} container{readyToPay.length === 1 ? "" : "s"} with
              published charges. Add each to your cart, then checkout when ready.
            </p>
          </header>

          {inCartCount > 0 ?
            <div className="flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-primary">
                <ShoppingCart className="size-4" aria-hidden />
                {inCartCount} of {readyToPay.length} container
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
                <BarrelOutboundShippingChargeCard row={row} />
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
                  {row.alias} — {row.slotLabel}
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
              {paid.length} container{paid.length === 1 ? "" : "s"} paid. Track the
              shipment status and download your customs clearance form below.
            </p>
          </header>
          <ul className="flex max-w-2xl flex-col gap-4">
            {paid.map((row) => (
              <li key={row.intakeId}>
                <BarrelOutboundShippingPaidCard row={row} />
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
