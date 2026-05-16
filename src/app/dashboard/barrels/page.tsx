import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { DashboardBarrelOfferingCard } from "@/components/dashboard/dashboard-barrel-offering-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listActiveContainerOfferingsWithImages } from "@/data/container-offerings";
import { listUserContainerCartWithOfferings } from "@/data/user-container-cart";

export default async function DashboardBarrelsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [catalog, cartRows] = await Promise.all([
    listActiveContainerOfferingsWithImages(),
    listUserContainerCartWithOfferings(userId),
  ]);

  const cartQtyByOffering = new Map(
    cartRows.map((r) => [r.offering.id, r.quantity]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Choose a container
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse photos, pick a quantity, and add to your cart. Containers are paid together
            with quoted items at checkout.
          </p>
        </div>
        <Link
          href="/dashboard/cart"
          className={buttonVariants({ variant: "outline", size: "default" })}
        >
          View cart
        </Link>
      </div>

      {catalog.length === 0 ?
        <Card>
          <CardHeader>
            <CardTitle>No containers listed yet</CardTitle>
            <CardDescription>
              When staff publish container options, they will appear here for you to add to
              your cart.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/cart"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to cart
            </Link>
          </CardContent>
        </Card>
      : (
        <ul className="grid gap-6 md:grid-cols-2">
          {catalog.map(({ offering, images }) => (
            <li key={offering.id}>
              <DashboardBarrelOfferingCard
                offering={{
                  id: offering.id,
                  name: offering.name,
                  sizeLabel: offering.sizeLabel,
                  priceUsdCents: offering.priceUsdCents,
                  isActive: offering.isActive,
                }}
                images={images.map((im) => ({
                  id: im.id,
                  imageUrl: im.imageUrl,
                  sortIndex: im.sortIndex,
                }))}
                cartQuantity={cartQtyByOffering.get(offering.id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
