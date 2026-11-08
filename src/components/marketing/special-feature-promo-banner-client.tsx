"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CalendarRange, Clock, Luggage, Package, Plane } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { SpecialFeatureWindowStatus } from "@/lib/special-feature-window-label";
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

const AVATAR_TONES = [
  "from-lime-300 to-emerald-500",
  "from-sky-300 to-indigo-500",
  "from-violet-400 to-fuchsia-500",
  "from-amber-300 to-orange-500",
  "from-cyan-300 to-teal-500",
];

function marqueeTrack(items: SpecialFeaturePromoBannerData[]): {
  track: SpecialFeaturePromoBannerData[];
  uniqueCount: number;
} {
  if (items.length === 0) return { track: [], uniqueCount: 0 };
  const minVisible = 6;
  const padded =
    items.length >= minVisible
      ? items
      : Array.from({ length: Math.ceil(minVisible / items.length) }, () => items).flat();
  return { track: [...padded, ...padded], uniqueCount: padded.length };
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
  const { track, uniqueCount } = useMemo(() => marqueeTrack(offers), [offers]);

  function openOfferById(offerId: string) {
    const index = offers.findIndex((o) => o.id === offerId);
    if (index >= 0) setOpenOfferIndex(index);
  }

  return (
    <>
      <section
        className={cn(
          "starter-bundle-marquee starter-bundle-marquee--reverse overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm ring-1 ring-foreground/5",
          className,
        )}
        aria-label={
          offers.length === 1 ?
            "Running suitcase special"
          : `${offers.length} running suitcase specials`
        }
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Luggage className="size-4 text-primary" aria-hidden />
            Suitcase specials
            {liveCount > 0 ?
              <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {liveCount} live
              </span>
            : null}
          </p>
          <span className="text-sm text-muted-foreground">Tap a card for details</span>
        </div>
        <div className="starter-bundle-marquee__viewport overflow-hidden py-3">
          <div className="starter-bundle-marquee__track flex w-max gap-3 px-4">
            {track.map((offer, index) => (
              <SpecialFeaturePromoMarqueeCard
                key={`${offer.id}-${index}`}
                offer={offer}
                toneIndex={index}
                duplicate={index >= uniqueCount}
                onOpenDetails={() => openOfferById(offer.id)}
              />
            ))}
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
            className="amani-storefront flex max-h-[min(92vh,760px)] w-[min(98vw,40rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground shadow-xl sm:max-w-none"
          >
            <SpecialFeaturePromoOfferDialogBody
              offer={openOffer}
              onClose={() => setOpenOfferIndex(null)}
            />
          </DialogContent>
        : null}
      </Dialog>
    </>
  );
}

function SpecialFeaturePromoMarqueeCard({
  offer,
  toneIndex,
  duplicate,
  onOpenDetails,
}: {
  offer: SpecialFeaturePromoBannerData;
  toneIndex: number;
  duplicate?: boolean;
  onOpenDetails: () => void;
}) {
  const isLive = offer.windowStatus === "Live";
  const slotsSoldOut =
    offer.slotsLabel?.toLowerCase().includes("capacity reached") ?? false;
  const metaLine = [
    offer.slotsLabel,
    offer.packagingModeLabel,
    offer.airlineName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      tabIndex={duplicate ? -1 : 0}
      aria-hidden={duplicate || undefined}
      title={`Open details: ${offer.name}`}
      className="flex min-w-[18.5rem] max-w-[22rem] shrink-0 items-center gap-3 rounded-2xl border border-border/80 bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-foreground/5 outline-none transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`size-9 shrink-0 rounded-full bg-gradient-to-br ${AVATAR_TONES[toneIndex % AVATAR_TONES.length]}`}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              isLive && !slotsSoldOut
                ? "border-primary/30 bg-primary/15 text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {isLive && !slotsSoldOut ?
              "Live"
            : slotsSoldOut ?
              "Sold out"
            : <span className="inline-flex items-center gap-1">
                <Clock className="size-2.5" aria-hidden />
                Soon
              </span>
            }
          </span>
          <p className="truncate text-sm font-semibold text-foreground">{offer.name}</p>
        </div>
        {metaLine ?
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine}</p>
        : <p className="mt-0.5 text-xs text-muted-foreground">Suitcase special</p>}
        {offer.priceLabel ?
          <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight text-foreground">
            {offer.priceLabel}
          </p>
        : null}
      </div>
    </button>
  );
}

function offerStatusMeta(offer: SpecialFeaturePromoBannerData): {
  label: string;
  soldOut: boolean;
} {
  const soldOut =
    offer.slotsLabel?.toLowerCase().includes("capacity reached") ?? false;
  if (soldOut) return { label: "Sold out", soldOut: true };
  if (offer.windowStatus === "Live") return { label: "Live", soldOut: false };
  if (offer.windowStatus === "Ended") return { label: "Ended", soldOut: false };
  return { label: "Soon", soldOut: false };
}

function DetailStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}

function SpecialFeaturePromoOfferDialogBody({
  offer,
  onClose,
}: {
  offer: SpecialFeaturePromoBannerData;
  onClose: () => void;
}) {
  const status = offerStatusMeta(offer);
  const noteParagraphs = offer.notes
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <>
      <DialogHeader className="shrink-0 border-b border-border px-5 py-5 sm:px-6">
        <div className="pr-8">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              status.label === "Live" && !status.soldOut
                ? "border-primary/30 bg-primary/15 text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {status.label === "Soon" ?
              <span className="inline-flex items-center gap-1">
                <Clock className="size-2.5" aria-hidden />
                Soon
              </span>
            : status.label}
          </span>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suitcase special
          </p>
          <DialogTitle className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {offer.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Full details for this suitcase special, including dates, slots, airline, and fees.
          </DialogDescription>
          {offer.priceLabel ?
            <div className="mt-3 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transportation fee
              </p>
              <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {offer.priceLabel}
              </p>
            </div>
          : null}
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {offer.windowLabel ?
            <div className="sm:col-span-2">
              <DetailStat
                icon={<CalendarRange className="size-3.5 text-primary" aria-hidden />}
                label="Offer period"
                value={offer.windowLabel}
              />
            </div>
          : null}
          {offer.slotsLabel ?
            <DetailStat
              icon={<Luggage className="size-3.5 text-primary" aria-hidden />}
              label="Suitcase slots"
              value={offer.slotsLabel}
            />
          : null}
          {offer.packagingModeLabel ?
            <DetailStat
              icon={<Package className="size-3.5 text-primary" aria-hidden />}
              label="Packaging"
              value={offer.packagingModeLabel}
            />
          : null}
          {offer.airlineName ?
            <DetailStat
              icon={<Plane className="size-3.5 text-primary" aria-hidden />}
              label="Airline"
              value={offer.airlineName}
            />
          : null}
        </div>

        {offer.bagFeesText || offer.airlineBagFeeExtraNote ?
          <section className="mt-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Airline bag fees
            </h3>
            {offer.bagFeesText ?
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {offer.bagFeesText}
              </p>
            : null}
            {offer.airlineBagFeeExtraNote ?
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {offer.airlineBagFeeExtraNote}
              </p>
            : null}
          </section>
        : null}

        {noteParagraphs.length > 0 ?
          <section className="mt-4 space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              About this special
            </h3>
            {noteParagraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        : null}
      </div>

      <div className="shrink-0 border-t border-border px-5 py-4 sm:px-6">
        <Link
          href="/dashboard/barrels"
          prefetch={false}
          onClick={onClose}
          className={cn(
            buttonVariants(),
            "h-11 rounded-full px-5 text-sm font-semibold",
          )}
        >
          View on barrels
        </Link>
      </div>
    </>
  );
}
