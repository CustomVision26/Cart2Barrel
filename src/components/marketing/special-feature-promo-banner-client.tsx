"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarRange, Luggage } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SpecialFeaturePromoBannerData = {
  name: string;
  priceLabel: string | null;
  windowLabel: string | null;
  packagingModeLabel: string;
  airlineName: string | null;
  bagFeesText: string | null;
  airlineBagFeeExtraNote: string | null;
  notes: string;
};

function buildMarqueeText(offer: SpecialFeaturePromoBannerData): string {
  return [
    `Special offer: ${offer.name}`,
    offer.priceLabel ? `Transportation fee ${offer.priceLabel}` : null,
    offer.windowLabel ? `Runs ${offer.windowLabel}` : null,
    offer.packagingModeLabel,
    offer.airlineName,
    offer.bagFeesText,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SpecialFeaturePromoBannerClient({
  offer,
  className,
}: {
  offer: SpecialFeaturePromoBannerData;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const marqueeText = useMemo(() => buildMarqueeText(offer), [offer]);

  const secondaryLine = [
    offer.packagingModeLabel,
    offer.airlineName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <button
        type="button"
        onDoubleClick={() => setOpen(true)}
        title="Double-click for full special offer details"
        aria-label={`Special offer: ${offer.name}. Double-click for full details.`}
        className={cn(
          "special-feature-promo-banner group relative w-full overflow-hidden rounded-xl border border-amber-400/45 text-left text-sm text-amber-950 shadow-md ring-1 ring-amber-300/30 transition-transform hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 dark:text-amber-50",
          className,
        )}
      >
        <div
          className="special-feature-promo-banner__bg absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 dark:from-amber-600 dark:via-orange-600 dark:to-amber-500"
          aria-hidden
        />
        <div
          className="special-feature-promo-banner__shine absolute inset-0 opacity-60 dark:opacity-40"
          aria-hidden
        />

        <div className="relative flex min-h-11 items-center gap-2 px-3 py-2">
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-950/10 bg-amber-950/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950/90 dark:border-white/15 dark:bg-black/20 dark:text-amber-50">
            <Luggage className="size-3" aria-hidden />
            Live
          </span>

          <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
            <div className="special-feature-promo-banner__track flex w-max items-center">
              {[0, 1].map((copy) => (
                <span
                  key={copy}
                  className="whitespace-nowrap px-6 text-sm font-medium"
                  aria-hidden={copy === 1}
                >
                  {marqueeText}
                </span>
              ))}
            </div>
          </div>

          <span className="hidden shrink-0 rounded-md border border-amber-950/10 bg-amber-950/10 px-2 py-0.5 text-[10px] font-medium text-amber-950/80 sm:inline dark:border-white/15 dark:bg-black/20 dark:text-amber-100/90">
            Double-click for details
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,720px)] w-[min(98vw,42rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
            <DialogTitle className="text-base leading-snug sm:text-lg">
              Special offer: {offer.name}
              {offer.priceLabel ?
                <span className="block text-sm font-normal text-muted-foreground">
                  Transportation fee · {offer.priceLabel}
                </span>
              : null}
            </DialogTitle>
            <DialogDescription className="space-y-2 text-pretty text-xs sm:text-sm">
              {offer.windowLabel ?
                <span className="flex items-start gap-2 text-foreground">
                  <CalendarRange
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">Offer period:</span>{" "}
                    {offer.windowLabel}
                  </span>
                </span>
              : null}
              {secondaryLine ?
                <span className="block text-muted-foreground">{secondaryLine}</span>
              : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm sm:px-6">
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
          </div>

          <div className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
            <Link
              href="/dashboard/barrels"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setOpen(false)}
            >
              View on barrels
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
