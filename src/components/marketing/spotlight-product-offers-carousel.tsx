"use client";

import Link from "next/link";
import { ExternalLink, ImageIcon, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  SpotlightProductCarouselNext,
  SpotlightProductCarouselPrevious,
} from "@/components/marketing/spotlight-carousel-nav";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type SpotlightGalleryImage = {
  id: string;
  imageUrl: string;
  label: string | null;
};

export type SpotlightOfferSlide = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceUsdCents: number | null;
  attributes: string | null;
  storeUrl: string;
  addHref: string;
  retailerName: string;
  galleryImages: SpotlightGalleryImage[];
  badge?: string;
};

const CARD_IMAGE_CLASS =
  "relative aspect-square w-full max-h-28 shrink-0 bg-muted/30 sm:max-h-32";
const CARD_BODY_CLASS = "flex flex-1 flex-col gap-2 p-2.5";
const CARD_SHELL_CLASS =
  "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-xs shadow-sm";

function galleryStartIndex(
  gallery: SpotlightGalleryImage[],
  imageUrl: string | null,
  id: string,
): number {
  const trimmed = imageUrl?.trim();
  if (trimmed) {
    const byUrl = gallery.findIndex((image) => image.imageUrl === trimmed);
    if (byUrl >= 0) return byUrl;
  }
  const byId = gallery.findIndex((image) => image.id === id);
  return byId >= 0 ? byId : 0;
}

type ImageViewerState = {
  title: string;
  retailerName: string;
  images: SpotlightGalleryImage[];
  startIndex: number;
};

function SpotlightImageViewer({
  viewer,
  onClose,
}: {
  viewer: ImageViewerState | null;
  onClose: () => void;
}) {
  const images = viewer?.images ?? [];
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!viewer || !carouselApi) return;
    carouselApi.scrollTo(viewer.startIndex, false);
  }, [viewer, carouselApi]);

  return (
    <Dialog open={viewer != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-base leading-snug">
            {viewer?.title}
          </DialogTitle>
          <DialogDescription>
            {viewer?.retailerName ?
              `${viewer.retailerName}${images.length > 1 ? ` · ${images.length} photos` : ""}`
            : images.length > 1 ?
              `${images.length} photos — use arrows or swipe to browse.`
            : "Product photo."}
          </DialogDescription>
        </DialogHeader>
        {images.length > 0 ?
          <div className="relative px-10">
            <Carousel
              className="w-full"
              opts={{ loop: images.length > 1 }}
              setApi={setCarouselApi}
            >
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={image.id}>
                    <div className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted/20 sm:aspect-[4/3]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.imageUrl}
                          alt={`${viewer?.title ?? "Product"} photo ${index + 1}`}
                          className="size-full object-contain"
                        />
                      </div>
                      {image.label ?
                        <p className="text-center text-xs text-muted-foreground">
                          {image.label}
                        </p>
                      : null}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 ?
                <>
                  <CarouselPrevious className="left-0 border-border/80 bg-background/90" />
                  <CarouselNext className="right-0 border-border/80 bg-background/90" />
                </>
              : null}
            </Carousel>
          </div>
        : null}
      </DialogContent>
    </Dialog>
  );
}

/** Uniform small product card for carousel slides. */
export function SpotlightOfferCard({
  title,
  imageUrl,
  priceUsdCents,
  attributes,
  storeUrl,
  addHref,
  retailerName,
  galleryImages,
  badge,
  onImageDoubleClick,
}: SpotlightOfferSlide & {
  onImageDoubleClick?: () => void;
}) {
  const extraGalleryCount = Math.max(0, (galleryImages ?? []).length - 1);

  return (
    <article className={cn(CARD_SHELL_CLASS, "transition-shadow hover:shadow-md")}>
      {imageUrl && onImageDoubleClick ?
        <button
          type="button"
          className={cn(
            CARD_IMAGE_CLASS,
            "block w-full cursor-zoom-in p-0 text-left",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          title="Double-click to enlarge"
          aria-label={`View photos for ${title}`}
          onDoubleClick={(event) => {
            event.preventDefault();
            onImageDoubleClick();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
          {badge ?
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
              {badge}
            </span>
          : null}
          {extraGalleryCount > 0 ?
            <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-background/90 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
              +{extraGalleryCount}
            </span>
          : null}
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold text-foreground shadow-sm backdrop-blur">
            {retailerName}
          </span>
        </button>
      : <div className={CARD_IMAGE_CLASS}>
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
          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold text-foreground shadow-sm backdrop-blur">
            {retailerName}
          </span>
        </div>
      }
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
  const [viewer, setViewer] = useState<ImageViewerState | null>(null);

  if (offers.length === 0) return null;

  const enableLoop = loop && offers.length > 2;

  return (
    <>
      <Carousel
        opts={{ align: "start", loop: enableLoop, dragFree: true }}
        className={cn("w-full", className)}
      >
        <div className="relative px-0.5 sm:px-1">
          <CarouselContent className="-ml-3">
            {offers.map((offer) => (
              <CarouselItem key={offer.id} className={SLIDE_BASIS}>
                <SpotlightOfferCard
                  {...offer}
                  onImageDoubleClick={
                    (offer.galleryImages ?? []).length > 0 ?
                      () =>
                        setViewer({
                          title: offer.title,
                          retailerName: offer.retailerName,
                          images: offer.galleryImages ?? [],
                          startIndex: galleryStartIndex(
                            offer.galleryImages ?? [],
                            offer.imageUrl,
                            offer.id,
                          ),
                        })
                    : undefined
                  }
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {showControls && offers.length > 1 ?
            <>
              <SpotlightProductCarouselPrevious />
              <SpotlightProductCarouselNext />
            </>
          : null}
        </div>
      </Carousel>

      <SpotlightImageViewer viewer={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
