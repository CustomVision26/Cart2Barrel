"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarRange, Clock, Luggage } from "lucide-react";

import type { SpecialFeatureWindowStatus } from "@/data/special-feature-offers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SpecialFeaturePromoBannerData = {
  id: string;
  name: string;
  windowStatus: SpecialFeatureWindowStatus;
  colorIndex: number;
  priceLabel: string | null;
  windowLabel: string | null;
  packagingModeLabel: string;
  airlineName: string | null;
  bagFeesText: string | null;
  airlineBagFeeExtraNote: string | null;
  notes: string;
  slotsLabel: string | null;
};

type PromoStripTheme = {
  chip: string;
  gradient: string;
  badge: string;
  text: string;
  meta: string;
  focusRing: string;
};

const PROMO_STRIP_THEMES: PromoStripTheme[] = [
  {
    chip: "border-amber-400/50 ring-amber-300/25",
    gradient:
      "from-amber-500 via-orange-500 to-amber-400 dark:from-amber-600 dark:via-orange-600 dark:to-amber-500",
    badge:
      "border-amber-950/10 bg-amber-950/15 text-amber-950 dark:border-white/15 dark:bg-black/25 dark:text-amber-50",
    text: "text-amber-950 dark:text-amber-50",
    meta: "text-amber-950/85 dark:text-amber-50/90",
    focusRing: "focus-visible:ring-amber-300/70",
  },
  {
    chip: "border-teal-400/50 ring-teal-300/25",
    gradient:
      "from-teal-500 via-emerald-500 to-teal-400 dark:from-teal-600 dark:via-emerald-600 dark:to-teal-500",
    badge:
      "border-teal-950/10 bg-teal-950/15 text-teal-950 dark:border-white/15 dark:bg-black/25 dark:text-teal-50",
    text: "text-teal-950 dark:text-teal-50",
    meta: "text-teal-950/85 dark:text-teal-50/90",
    focusRing: "focus-visible:ring-teal-300/70",
  },
  {
    chip: "border-violet-400/50 ring-violet-300/25",
    gradient:
      "from-violet-500 via-purple-500 to-violet-400 dark:from-violet-600 dark:via-purple-600 dark:to-violet-500",
    badge:
      "border-violet-950/10 bg-violet-950/15 text-violet-950 dark:border-white/15 dark:bg-black/25 dark:text-violet-50",
    text: "text-violet-950 dark:text-violet-50",
    meta: "text-violet-950/85 dark:text-violet-50/90",
    focusRing: "focus-visible:ring-violet-300/70",
  },
  {
    chip: "border-sky-400/50 ring-sky-300/25",
    gradient:
      "from-sky-500 via-blue-500 to-sky-400 dark:from-sky-600 dark:via-blue-600 dark:to-sky-500",
    badge:
      "border-sky-950/10 bg-sky-950/15 text-sky-950 dark:border-white/15 dark:bg-black/25 dark:text-sky-50",
    text: "text-sky-950 dark:text-sky-50",
    meta: "text-sky-950/85 dark:text-sky-50/90",
    focusRing: "focus-visible:ring-sky-300/70",
  },
  {
    chip: "border-rose-400/50 ring-rose-300/25",
    gradient:
      "from-rose-500 via-pink-500 to-rose-400 dark:from-rose-600 dark:via-pink-600 dark:to-rose-500",
    badge:
      "border-rose-950/10 bg-rose-950/15 text-rose-950 dark:border-white/15 dark:bg-black/25 dark:text-rose-50",
    text: "text-rose-950 dark:text-rose-50",
    meta: "text-rose-950/85 dark:text-rose-50/90",
    focusRing: "focus-visible:ring-rose-300/70",
  },
];

function promoStripTheme(colorIndex: number): PromoStripTheme {
  return PROMO_STRIP_THEMES[colorIndex % PROMO_STRIP_THEMES.length]!;
}

function buildOfferMarqueeLabel(offer: SpecialFeaturePromoBannerData): string {
  return [
    offer.name,
    offer.priceLabel ? `Transportation ${offer.priceLabel}` : null,
    offer.windowLabel,
    offer.packagingModeLabel,
    offer.airlineName,
    offer.bagFeesText,
    offer.slotsLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SpecialFeaturePromoBannerClient({
  offers,
  className,
}: {
  offers: SpecialFeaturePromoBannerData[];
  className?: string;
}) {
  const [openOfferIndex, setOpenOfferIndex] = useState<number | null>(null);
  const openOffer = openOfferIndex != null ? offers[openOfferIndex] ?? null : null;
  const liveCount = offers.filter((o) => o.windowStatus === "Live").length;

  const marqueeOffers = useMemo(
    () => [...offers, ...offers],
    [offers],
  );

  const ariaMarqueeText = useMemo(
    () => offers.map(buildOfferMarqueeLabel).join(" ◆ "),
    [offers],
  );

  function openOfferById(offerId: string) {
    const index = offers.findIndex((o) => o.id === offerId);
    if (index >= 0) setOpenOfferIndex(index);
  }

  return (
    <>
      <section
        className={cn(
          "special-feature-promo-banner group/banner relative overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-md ring-1 ring-border/50",
          className,
        )}
        aria-label={
          offers.length === 1 ?
            "Running special offer banner"
          : `${offers.length} running special offer banners`
        }
      >
        <div
          className="special-feature-promo-banner__shine pointer-events-none absolute inset-0 z-[1] opacity-40 dark:opacity-25"
          aria-hidden
        />

        <div className="relative z-[2] flex min-h-12 items-stretch">
          <div className="flex shrink-0 items-center gap-1.5 border-r border-border/50 bg-background/80 px-2.5 py-2 backdrop-blur-sm sm:px-3">
            <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Luggage className="size-3" aria-hidden />
              {liveCount > 0 ? `${liveCount} live` : "Offers"}
            </span>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
            <div
              className="special-feature-promo-banner__track flex w-max items-center gap-3 py-2 pr-3"
              aria-hidden
            >
              {marqueeOffers.map((offer, copyIndex) => (
                <SpecialFeaturePromoMarqueeChip
                  key={`${offer.id}-${copyIndex}`}
                  offer={offer}
                  onOpenDetails={() => openOfferById(offer.id)}
                />
              ))}
            </div>
            <p className="sr-only">{ariaMarqueeText}</p>
          </div>

          <div className="hidden shrink-0 items-center border-l border-border/50 bg-background/80 px-2.5 backdrop-blur-sm sm:flex">
            <span className="text-[10px] font-medium text-muted-foreground">
              Tap to open
            </span>
          </div>
        </div>
      </section>

      <Dialog
        open={openOffer != null}
        onOpenChange={(next) => {
          if (!next) setOpenOfferIndex(null);
        }}
      >
        {openOffer ?
          <DialogContent
            showCloseButton
            className="flex max-h-[min(92vh,720px)] w-[min(98vw,42rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
              <DialogTitle className="text-base leading-snug sm:text-lg">
                Special offer: {openOffer.name}
                {openOffer.priceLabel ?
                  <span className="block text-sm font-normal text-muted-foreground">
                    Transportation fee · {openOffer.priceLabel}
                  </span>
                : null}
              </DialogTitle>
              <DialogDescription className="text-pretty text-xs sm:text-sm">
                Full details for this suitcase special.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <SpecialFeaturePromoOfferDetails offer={openOffer} />
            </div>

            <div className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
              <Link
                href="/dashboard/barrels"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setOpenOfferIndex(null)}
              >
                View on barrels
              </Link>
            </div>
          </DialogContent>
        : null}
      </Dialog>
    </>
  );
}

function SpecialFeaturePromoMarqueeChip({
  offer,
  onOpenDetails,
}: {
  offer: SpecialFeaturePromoBannerData;
  onOpenDetails: () => void;
}) {
  const theme = promoStripTheme(offer.colorIndex);
  const isLive = offer.windowStatus === "Live";
  const slotsSoldOut =
    offer.slotsLabel?.toLowerCase().includes("capacity reached") ?? false;
  const summaryLine = [
    offer.slotsLabel,
    offer.priceLabel ? offer.priceLabel : null,
    offer.packagingModeLabel,
    offer.airlineName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      title={`Open details: ${offer.name}`}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border px-3 py-1.5 text-left shadow-sm ring-1 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2",
        theme.chip,
        theme.focusRing,
      )}
    >
      <div
        className={cn("absolute inset-0 bg-gradient-to-r opacity-95", theme.gradient)}
        aria-hidden
      />
      <div className="relative flex items-center gap-2 whitespace-nowrap">
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            theme.badge,
          )}
        >
          {isLive && !slotsSoldOut ?
            "Live"
          : slotsSoldOut ?
            "Sold out"
          : <>
              <Clock className="size-2.5" aria-hidden />
              Soon
            </>
          }
        </span>
        <span className={cn("text-xs font-semibold sm:text-sm", theme.text)}>
          {offer.name}
        </span>
        {summaryLine ?
          <span className={cn("text-[11px] font-medium sm:text-xs", theme.meta)}>
            · {summaryLine}
          </span>
        : null}
        {offer.windowLabel ?
          <span className={cn("hidden text-[11px] lg:inline", theme.meta)}>
            · {offer.windowLabel}
          </span>
        : null}
      </div>
    </button>
  );
}

function SpecialFeaturePromoOfferDetails({
  offer,
}: {
  offer: SpecialFeaturePromoBannerData;
}) {
  const secondaryLine = [
    offer.packagingModeLabel,
    offer.airlineName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-3 px-5 py-4 text-sm sm:px-6">
      <div className="space-y-2">
        {offer.windowLabel ?
          <p className="flex items-start gap-2 text-xs text-foreground sm:text-sm">
            <CalendarRange
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span>
              <span className="font-medium">Offer period:</span> {offer.windowLabel}
            </span>
          </p>
        : null}
        {offer.slotsLabel ?
          <p className="text-xs font-medium text-foreground sm:text-sm">
            {offer.slotsLabel}
          </p>
        : null}
        {secondaryLine ?
          <p className="text-xs text-muted-foreground sm:text-sm">{secondaryLine}</p>
        : null}
      </div>
      {offer.bagFeesText ?
        <p className="text-muted-foreground">{offer.bagFeesText}</p>
      : null}
      {offer.airlineBagFeeExtraNote ?
        <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
          {offer.airlineBagFeeExtraNote}
        </p>
      : null}
      <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
        {offer.notes}
      </p>
    </section>
  );
}
