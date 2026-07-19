"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarRange, Luggage } from "lucide-react";

import { setUserContainerCartQuantityAction } from "@/actions/user-container-cart";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import {
  clampSpecialSuitcaseQty,
  computeSpecialFeatureAirlineBaggageFeeCents,
  formatSpecialFeatureOutsideBagFees,
  isSpecialSuitcaseOfferingUnavailable,
  maxSpecialSuitcaseQtyForOffering,
  SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY,
} from "@/lib/special-feature-bag-fees";
import { resolveSpecialFeatureNotes } from "@/lib/special-feature-notes";
import { formatSpecialFeatureWindowLabel } from "@/lib/special-feature-window-label";
import { cn } from "@/lib/utils";
import {
  specialFeaturePackagingModeLabel,
  type SpecialFeaturePackagingMode,
} from "@/lib/validations/special-feature-offer";

export type SerializableSpecialFeatureImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

export type DashboardSpecialFeatureSuitcaseCardProps = {
  offer: {
    id: string;
    name: string;
    sizeLabel: string;
    destinationLocation: string;
    packagingMode: SpecialFeaturePackagingMode;
    priceUsdCents: number;
    airlineName: string;
    travelAt: string | null;
    airlineSecondBagUsdCents: number;
    airlineThirdBagUsdCents: number;
    airlineFourthBagUsdCents: number;
    airlineBagFeeExtraNote: string;
    notes: string;
    startsAt: string;
    endsAt: string;
  };
  offering: {
    id: string;
    sizeLabel: string;
    priceUsdCents: number;
  } | null;
  images: SerializableSpecialFeatureImage[];
  cartQuantity: number | null;
  /** Total special suitcases across all sizes in the user's cart. */
  specialSuitcaseCartTotal: number;
};

function formatDateTimeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DashboardSpecialFeatureSuitcaseCard({
  offer,
  offering,
  images,
  cartQuantity,
  specialSuitcaseCartTotal,
}: DashboardSpecialFeatureSuitcaseCardProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const currentInCart = cartQuantity != null && cartQuantity > 0 ? cartQuantity : 0;
  const maxQtyForOffering = maxSpecialSuitcaseQtyForOffering(
    specialSuitcaseCartTotal,
    currentInCart,
  );
  const isUnavailable = isSpecialSuitcaseOfferingUnavailable(
    specialSuitcaseCartTotal,
    currentInCart,
  );
  const [qty, setQty] = useState(() =>
    clampSpecialSuitcaseQty(
      currentInCart > 0 ? currentInCart : 1,
      maxQtyForOffering,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isInApp = offer.packagingMode === "in_app" && Boolean(offering);

  useEffect(() => {
    setQty(
      clampSpecialSuitcaseQty(
        currentInCart > 0 ? currentInCart : 1,
        maxQtyForOffering,
      ),
    );
  }, [currentInCart, maxQtyForOffering]);

  const sizeLabel = offering?.sizeLabel ?? offer.sizeLabel;
  const catalogPriceCents = offering?.priceUsdCents ?? 0;
  const transportationFeeCents = offer.priceUsdCents;
  const windowLabel = formatSpecialFeatureWindowLabel(offer.startsAt, offer.endsAt);
  const startsLabel = formatDateTimeLabel(offer.startsAt);
  const notes = resolveSpecialFeatureNotes(offer.notes);
  const bagFeesBit = formatSpecialFeatureOutsideBagFees({
    airlineSecondBagUsdCents: offer.airlineSecondBagUsdCents,
    airlineThirdBagUsdCents: offer.airlineThirdBagUsdCents,
    airlineFourthBagUsdCents: offer.airlineFourthBagUsdCents,
  });
  const travelLabel = formatDateTimeLabel(offer.travelAt);
  const endsLabel = formatDateTimeLabel(offer.endsAt);
  const packagingLabel = specialFeaturePackagingModeLabel(offer.packagingMode);
  const airlineLabel = offer.airlineName.trim();
  const bagFeesForQty = computeSpecialFeatureAirlineBaggageFeeCents(qty, {
    airlineSecondBagUsdCents: offer.airlineSecondBagUsdCents,
    airlineThirdBagUsdCents: offer.airlineThirdBagUsdCents,
  });

  function handleAddToCart() {
    if (!offering || isUnavailable) return;
    const safeQty = clampSpecialSuitcaseQty(qty, maxQtyForOffering);
    if (safeQty !== qty) setQty(safeQty);
    setError(null);
    startTransition(async () => {
      const res = await setUserContainerCartQuantityAction({
        offeringId: offering.id,
        quantity: safeQty,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden border-primary/40 bg-primary/5 ring-1 ring-primary/20 transition-[opacity,filter,border-color,background-color] duration-200",
          isUnavailable &&
            "border-border/60 bg-muted/15 opacity-55 ring-border/30 saturate-[0.25]",
        )}
        aria-disabled={isUnavailable || undefined}
      >
        <CardHeader className="space-y-1 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle
              className={cn(
                "flex items-center gap-2 text-lg",
                isUnavailable && "text-muted-foreground",
              )}
            >
              <Luggage className="size-4 shrink-0 text-primary" aria-hidden />
              {offer.name}
            </CardTitle>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {isUnavailable ?
                <span className="rounded-full border border-border/80 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  At capacity
                </span>
              : null}
              <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                Special
              </span>
              <span className="rounded-full border border-border/80 bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                Suitcase
              </span>
            </div>
          </div>
          <CardDescription>
            {transportationFeeCents > 0 ?
              `Transportation fee · ${formatUsd(transportationFeeCents)}`
            : "Special suitcase offer"}
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn("space-y-4", isUnavailable && "pointer-events-none select-none")}
        >
          <div className="relative px-10 pb-1">
            {images.length > 0 ?
              <Carousel className="w-full" opts={{ loop: images.length > 1 }}>
                <CarouselContent>
                  {images.map((im) => (
                    <CarouselItem key={im.id}>
                      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-primary/25 bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={im.imageUrl}
                          alt={`${offer.name} — ${sizeLabel}`}
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 ?
                  <>
                    <CarouselPrevious className="left-1 border-border/80 bg-background/90" />
                    <CarouselNext className="right-1 border-border/80 bg-background/90" />
                  </>
                : null}
              </Carousel>
            : <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-primary/30 bg-muted/40 text-sm text-muted-foreground">
                Photos coming soon
              </div>
            }
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">
              {sizeLabel} · Suitcase
              {catalogPriceCents > 0 ?
                ` · ${formatUsd(catalogPriceCents)}`
              : null}
            </p>
            {transportationFeeCents > 0 ?
              <p className="text-xs text-muted-foreground">
                Transportation fee · {formatUsd(transportationFeeCents)}
              </p>
            : null}
            {airlineLabel ?
              <p className="text-xs text-muted-foreground">{airlineLabel}</p>
            : null}
            {bagFeesForQty > 0 ?
              <p className="text-xs text-muted-foreground">
                Airline baggage (travel day) · {formatUsd(bagFeesForQty)}
              </p>
            : null}
          </div>

          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className={cn(
              "text-sm font-medium text-primary underline-offset-4 hover:underline",
              isUnavailable && "pointer-events-auto",
            )}
          >
            View special details
          </button>

          {error ?
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          : null}

          {isInApp ?
            isUnavailable ?
              <p className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Courier capacity is full ({SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY}{" "}
                special suitcases max). Remove one from your cart to choose another
                size.
              </p>
            : <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor={`sf-qty-${offer.id}`}
                  >
                    Qty
                  </label>
                  <Input
                    id={`sf-qty-${offer.id}`}
                    type="number"
                    min={1}
                    max={maxQtyForOffering}
                    className="w-20"
                    value={qty}
                    onChange={(e) =>
                      setQty(
                        clampSpecialSuitcaseQty(
                          Number.parseInt(e.target.value, 10) || 1,
                          maxQtyForOffering,
                        ),
                      )
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Max {SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY} total across special
                    sizes
                    {maxQtyForOffering < SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY ?
                      ` · ${maxQtyForOffering} left for this size`
                    : null}
                  </p>
                </div>
                <Button type="button" disabled={pending} onClick={handleAddToCart}>
                  {pending ?
                    "Adding…"
                  : currentInCart > 0 ?
                    "Update cart"
                  : "Add to cart"}
                </Button>
              </div>
          : null}
        </CardContent>

        {isInApp ?
          <CardFooter className="space-y-1.5 border-t border-border/50 bg-muted/40 py-3 text-xs text-muted-foreground">
            {windowLabel ?
              <p className="flex items-start gap-2 text-pretty leading-relaxed">
                <CalendarRange
                  className="mt-0.5 size-3.5 shrink-0 text-primary/80"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground/90">Offer period:</span>{" "}
                  {windowLabel}
                </span>
              </p>
            : startsLabel ?
              <p className="flex items-start gap-2 text-pretty leading-relaxed">
                <CalendarRange
                  className="mt-0.5 size-3.5 shrink-0 text-primary/80"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground/90">Offer starts:</span>{" "}
                  {startsLabel}
                </span>
              </p>
            : null}
            <p className="leading-relaxed text-muted-foreground/90">
              Charged at checkout with your other cart items.
            </p>
          </CardFooter>
        : <CardFooter className="space-y-1.5 border-t border-border/50 bg-muted/40 py-3 text-xs text-muted-foreground">
            {windowLabel ?
              <p className="flex items-start gap-2 text-pretty leading-relaxed">
                <CalendarRange
                  className="mt-0.5 size-3.5 shrink-0 text-primary/80"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground/90">Offer period:</span>{" "}
                  {windowLabel}
                </span>
              </p>
            : null}
            <p className="leading-relaxed">
              Outside packaging — no in-app suitcase purchase. Contact support or bring
              your packed suitcase to the hub during this offer.
            </p>
          </CardFooter>
        }
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,720px)] w-[min(98vw,42rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
            <DialogTitle className="text-base leading-snug sm:text-lg">
              {offer.name}
            </DialogTitle>
            <DialogDescription className="space-y-2 text-pretty text-xs sm:text-sm">
              {windowLabel ?
                <span className="flex items-start gap-2 text-foreground">
                  <CalendarRange
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">Offer period:</span> {windowLabel}
                  </span>
                </span>
              : null}
              <span className="block text-muted-foreground">
                {packagingLabel}
                {offer.airlineName.trim() ? ` · ${offer.airlineName.trim()}` : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm sm:px-6">
            <p>
              <span className="font-medium text-foreground">Packaging: </span>
              {packagingLabel}
              {offer.packagingMode === "in_app" ?
                " — pay the transportation fee here; staff purchase your items in-app."
              : " — pack the suitcase yourself and bring it to be shipped."}
            </p>
            {offer.destinationLocation.trim() ?
              <p>
                <span className="font-medium text-foreground">Destination: </span>
                {offer.destinationLocation.trim()}
              </p>
            : null}
            {travelLabel ?
              <p>
                <span className="font-medium text-foreground">Travel day: </span>
                {travelLabel}
              </p>
            : null}
            {bagFeesBit ?
              <p className="text-muted-foreground">{bagFeesBit}</p>
            : null}
            {offer.airlineBagFeeExtraNote.trim() ?
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {offer.airlineBagFeeExtraNote.trim()}
              </p>
            : null}
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
              {notes}
            </p>
            {endsLabel ?
              <p className="text-xs text-muted-foreground">Offer ends {endsLabel}</p>
            : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
