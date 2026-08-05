import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { DashboardBarrelOfferingCard } from "@/components/dashboard/dashboard-barrel-offering-card";
import { DashboardSpecialFeatureSuitcaseCard } from "@/components/dashboard/dashboard-special-feature-suitcase-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listActiveContainerOfferingsWithImages } from "@/data/container-offerings";
import { listActiveSpecialFeatureSuitcasesForBarrels } from "@/data/special-feature-offers";
import { getSpecialOfferSlotSummariesByOfferId } from "@/data/special-feature-suitcase-slots";
import {
  listUserContainerCartWithOfferings,
  sumSpecialSuitcaseCartQuantityFromRows,
} from "@/data/user-container-cart";
import type { SpecialFeaturePackagingMode } from "@/lib/validations/special-feature-offer";

export default async function DashboardBarrelsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [catalog, cartRows, specialSuitcasesResult] = await Promise.all([
    listActiveContainerOfferingsWithImages(),
    listUserContainerCartWithOfferings(userId),
    listActiveSpecialFeatureSuitcasesForBarrels(),
  ]);

  const specialSuitcases = specialSuitcasesResult.suitcases;

  const uniqueOffers = [
    ...new Map(specialSuitcases.map(({ offer }) => [offer.id, offer])).values(),
  ];
  const slotSummaries = await getSpecialOfferSlotSummariesByOfferId(uniqueOffers);

  const cartQtyByOffering = new Map(
    cartRows.map((r) => [r.offering.id, r.quantity]),
  );

  const specialOfferingIds = new Set(specialSuitcasesResult.specialOfferingIds);

  const specialSuitcaseCartTotal = sumSpecialSuitcaseCartQuantityFromRows(
    cartRows.map((r) => ({ offeringId: r.offering.id, quantity: r.quantity })),
    specialOfferingIds,
  );

  const empty = catalog.length === 0 && specialSuitcases.length === 0;

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

      {specialSuitcases.length > 0 ?
        <ul className="grid gap-6 md:grid-cols-2">
          {specialSuitcases.map(({ offer, offering, images }) => {
            const slots = slotSummaries.get(offer.id);
            return (
            <li key={`${offer.id}-${offering?.id ?? "outside"}`}>
              <DashboardSpecialFeatureSuitcaseCard
                offer={{
                  id: offer.id,
                  name: offer.name,
                  sizeLabel: offer.sizeLabel,
                  destinationLocation: offer.destinationLocation,
                  packagingMode: offer.packagingMode as SpecialFeaturePackagingMode,
                  priceUsdCents: offer.priceUsdCents,
                  airlineName: offer.airlineName,
                  travelAt: offer.travelAt,
                  airlineSecondBagUsdCents: offer.airlineSecondBagUsdCents,
                  airlineThirdBagUsdCents: offer.airlineThirdBagUsdCents,
                  airlineFourthBagUsdCents: offer.airlineFourthBagUsdCents,
                  airlineBagFeeExtraNote: offer.airlineBagFeeExtraNote,
                  notes: offer.notes,
                  startsAt: offer.startsAt,
                  endsAt: offer.endsAt,
                }}
                offering={
                  offering ?
                    {
                      id: offering.id,
                      sizeLabel: offering.sizeLabel,
                      priceUsdCents: offering.priceUsdCents,
                    }
                  : null
                }
                images={images.map((im) => ({
                  id: im.id,
                  imageUrl: im.imageUrl,
                  sortIndex: im.sortIndex,
                }))}
                cartQuantity={
                  offering ? (cartQtyByOffering.get(offering.id) ?? null) : null
                }
                specialSuitcaseCartTotal={specialSuitcaseCartTotal}
                offerSlotsRemaining={slots?.remaining ?? null}
                offerSlotCapacity={slots?.capacity ?? null}
              />
            </li>
            );
          })}
        </ul>
      : null}

      {empty ?
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
      : catalog.length > 0 ?
        <ul className="grid gap-6 md:grid-cols-2">
          {catalog.map(({ offering, images }) => (
            <li key={offering.id}>
              <DashboardBarrelOfferingCard
                offering={{
                  id: offering.id,
                  name: offering.name,
                  sizeLabel: offering.sizeLabel,
                  kind: offering.kind,
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
      : null}
    </div>
  );
}
