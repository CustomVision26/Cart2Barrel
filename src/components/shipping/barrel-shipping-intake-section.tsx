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

type BarrelShippingIntakeSectionProps = {
  data: BarrelShippingIntakePageData;
  shippingAddress: Address | undefined;
  shippingAddressComplete: boolean;
};

export function BarrelShippingIntakeSection({
  data,
  shippingAddress,
  shippingAddressComplete,
}: BarrelShippingIntakeSectionProps) {
  const { awaiting, submitted } = data;

  return (
    <div className="space-y-8">
      {awaiting.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Containers ready to ship
            </h2>
            <p className="text-sm text-muted-foreground">
              {awaiting.length} container{awaiting.length === 1 ? "" : "s"} at
              100% load or marked full. Continue to pricing for each one below.
            </p>
          </header>

          <div className="flex max-w-2xl flex-col gap-6">
            {awaiting.map((container) => (
              <BarrelShippingIntakeForm
                key={container.barrelId}
                container={container}
                shippingAddress={shippingAddress}
              />
            ))}
          </div>
        </section>
      : null}

      {submitted.length > 0 ?
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Ready for pricing
            </h2>
            <p className="text-sm text-muted-foreground">
              We received your confirmation. View freight, customs, and pickup
              charges on the{" "}
              <Link
                href={DASHBOARD_SHIPPING_ROUTES.pricing}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Pricing
              </Link>{" "}
              tab and add them to your cart when ready. After freight is paid,
              shipment tracking and customs updates appear here.
            </p>
          </header>

          <ul className="flex max-w-2xl flex-col gap-6">
            {submitted.map((row) => (
              <li key={row.intakeId}>
                <BarrelShippingIntakeSubmittedCard row={row} />
              </li>
            ))}
          </ul>
        </section>
      : null}

      {awaiting.length === 0 && submitted.length === 0 ?
        <Card className="max-w-2xl border-dashed border-border/80">
          <CardHeader>
            <CardTitle className="text-base">No containers ready yet</CardTitle>
            <CardDescription>
              When a container reaches 100% load or is marked full, continue to
              pricing here. Pack items in{" "}
              <Link
                href="/dashboard/barrels"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                My containers
              </Link>{" "}
              and watch load progress on each slot.
            </CardDescription>
          </CardHeader>
        </Card>
      : null}
    </div>
  );
}
