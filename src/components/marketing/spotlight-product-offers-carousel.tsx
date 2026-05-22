"use client";

import Link from "next/link";
import { ExternalLink, ImageIcon, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type SpotlightOfferSlide = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceUsdCents: number | null;
  attributes: string | null;
  storeUrl: string;
  addHref: string;
  badge?: string;
};

const CARD_IMAGE_CLASS =
  "relative aspect-square w-full max-h-28 shrink-0 bg-muted/30 sm:max-h-32";
const CARD_BODY_CLASS = "flex flex-1 flex-col gap-2 p-2.5";
const CARD_SHELL_CLASS =
  "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-xs shadow-sm";

/** Uniform small product card for carousel slides. */
export function SpotlightOfferCard({
  title,
  imageUrl,
  priceUsdCents,
  attributes,
  storeUrl,
  addHref,
  badge,
}: SpotlightOfferSlide) {
  return (
    <article className={cn(CARD_SHELL_CLASS, "transition-shadow hover:shadow-md")}>
      <div className={CARD_IMAGE_CLASS}>
        {imageUrl ?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="size-full object-cover" />
        : <div className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground">
            <ImageIcon className="size-5" aria-hidden />
          </div>
        }
        {badge ?
          <span className="absolute left-1.5 top-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
            {badge}
          </span>
        : null}
      </div>
      <div className={CARD_BODY_CLASS}>
        <div className="min-h-[2.75rem] space-y-0.5">
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
            {title}
          </h3>
          {priceUsdCents != null && priceUsdCents > 0 ?
            <p className="text-sm font-bold text-primary">
              {formatUsd(priceUsdCents)}
            </p>
          : null}
          {attributes ?
            <p className="line-clamp-1 text-[10px] text-muted-foreground">
              {attributes}
            </p>
          : null}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 px-2 text-[11px]"
            nativeButton={false}
            render={
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="truncate">View</span>
          </Button>
          <Button
            size="sm"
            className="h-7 min-w-0 px-2 text-[11px]"
            nativeButton={false}
            render={<Link href={addHref} />}
          >
            <Plus className="size-3 shrink-0" aria-hidden />
            <span className="truncate">Request</span>
          </Button>
        </div>
      </div>
    </article>
  );
}

const SLIDE_BASIS =
  "basis-[72%] pl-3 sm:basis-[48%] md:basis-[36%] lg:basis-[28%] xl:basis-[22%]";

type SpotlightProductOffersCarouselProps = {
  offers: SpotlightOfferSlide[];
  loop?: boolean;
  showControls?: boolean;
  className?: string;
};

export function SpotlightProductOffersCarousel({
  offers,
  loop = true,
  showControls = true,
  className,
}: SpotlightProductOffersCarouselProps) {
  if (offers.length === 0) return null;

  const enableLoop = loop && offers.length > 2;

  return (
    <Carousel
      opts={{ align: "start", loop: enableLoop, dragFree: true }}
      className={cn("w-full", className)}
    >
      <div className="relative">
        <CarouselContent className="-ml-3">
          {offers.map((offer) => (
            <CarouselItem key={offer.id} className={SLIDE_BASIS}>
              <SpotlightOfferCard {...offer} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {showControls && offers.length > 1 ?
          <>
            <CarouselPrevious
              variant="outline"
              className="left-0 border-border bg-background/95 shadow-sm backdrop-blur sm:-left-1"
            />
            <CarouselNext
              variant="outline"
              className="right-0 border-border bg-background/95 shadow-sm backdrop-blur sm:-right-1"
            />
          </>
        : null}
      </div>
    </Carousel>
  );
}
