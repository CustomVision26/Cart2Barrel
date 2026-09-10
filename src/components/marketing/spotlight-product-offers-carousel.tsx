"use client";

import { useEffect, useState } from "react";

import {
  SpotlightProductCarouselNext,
  SpotlightProductCarouselPrevious,
} from "@/components/marketing/spotlight-carousel-nav";
import { SpotlightVariantShop } from "@/components/marketing/spotlight-variant-shop";
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
import {
  hasSpotlightVariantPicker,
  type SpotlightVariantSku,
} from "@/lib/spotlight-variant-axes";
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
  variantSkus: SpotlightVariantSku[];
};

export function galleryStartIndex(
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

export type ImageViewerState = {
  title: string;
  retailerName: string;
  images: SpotlightGalleryImage[];
  startIndex: number;
};

export function SpotlightImageViewer({
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
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted sm:aspect-[4/3]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.imageUrl}
                          alt={`${viewer?.title ?? "Product"} photo ${index + 1}`}
                          className="size-full object-contain"
                          referrerPolicy="no-referrer"
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

/** Compact carousel card. Variant pickers open in a dialog on double-click. */
export function SpotlightOfferCard({
  id,
  title,
  imageUrl,
  priceUsdCents,
  attributes,
  storeUrl,
  addHref,
  retailerName,
  galleryImages,
  badge,
  variantSkus,
  onImageDoubleClick,
  onCardDoubleClick,
}: SpotlightOfferSlide & {
  onImageDoubleClick?: () => void;
  onCardDoubleClick?: () => void;
}) {
  const extraGalleryCount = Math.max(0, (galleryImages ?? []).length - 1);

  return (
    <SpotlightVariantShop
      key={`${id}:${(variantSkus ?? []).map((sku) => sku.id).join("\0")}`}
      layout="card"
      title={title}
      retailerName={retailerName}
      fallbackImageUrl={imageUrl}
      fallbackPriceUsdCents={priceUsdCents}
      fallbackStoreUrl={storeUrl}
      fallbackAddHref={addHref}
      fallbackAttributes={attributes}
      skus={variantSkus ?? []}
      badge={badge}
      extraGalleryCount={extraGalleryCount}
      onImageDoubleClick={onImageDoubleClick}
      onCardDoubleClick={onCardDoubleClick}
    />
  );
}

const SLIDE_BASIS =
  "basis-[88%] pl-3 sm:basis-[62%] md:basis-[48%] lg:basis-[40%] xl:basis-[34%]";

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
  const [shopOffer, setShopOffer] = useState<SpotlightOfferSlide | null>(null);

  if (offers.length === 0) return null;

  const enableLoop = loop && offers.length > 2;

  function openGallery(offer: SpotlightOfferSlide) {
    if ((offer.galleryImages ?? []).length === 0) return;
    setViewer({
      title: offer.title,
      retailerName: offer.retailerName,
      images: offer.galleryImages ?? [],
      startIndex: galleryStartIndex(
        offer.galleryImages ?? [],
        offer.imageUrl,
        offer.id,
      ),
    });
  }

  return (
    <>
      <Carousel
        opts={{ align: "start", loop: enableLoop, dragFree: true }}
        className={cn("w-full", className)}
      >
        <div className="relative px-0.5 sm:px-1">
          <CarouselContent className="-ml-3">
            {offers.map((offer) => {
              const hasPicker = hasSpotlightVariantPicker(offer.variantSkus ?? []);
              return (
                <CarouselItem key={offer.id} className={SLIDE_BASIS}>
                  <SpotlightOfferCard
                    {...offer}
                    onCardDoubleClick={
                      hasPicker ? () => setShopOffer(offer) : undefined
                    }
                    onImageDoubleClick={
                      !hasPicker && (offer.galleryImages ?? []).length > 0
                        ? () => openGallery(offer)
                        : undefined
                    }
                  />
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {showControls && offers.length > 1 ?
            <>
              <SpotlightProductCarouselPrevious />
              <SpotlightProductCarouselNext />
            </>
          : null}
        </div>
      </Carousel>

      <Dialog
        open={shopOffer != null}
        onOpenChange={(open) => !open && setShopOffer(null)}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(94vh,900px)] w-[min(98vw,56rem)] max-w-none flex-col gap-3 overflow-hidden sm:max-w-none"
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-lg leading-snug sm:text-xl">
              {shopOffer?.title ?? "Product options"}
            </DialogTitle>
            <DialogDescription>
              Pick a color and size. The photo, price, View link, and Request
              follow the selected variant.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {shopOffer ?
              <SpotlightVariantShop
                key={shopOffer.id}
                layout="dialog"
                title={shopOffer.title}
                retailerName={shopOffer.retailerName}
                fallbackImageUrl={shopOffer.imageUrl}
                fallbackPriceUsdCents={shopOffer.priceUsdCents}
                fallbackStoreUrl={shopOffer.storeUrl}
                fallbackAddHref={shopOffer.addHref}
                fallbackAttributes={shopOffer.attributes}
                skus={shopOffer.variantSkus ?? []}
                badge={shopOffer.badge}
                extraGalleryCount={Math.max(
                  0,
                  (shopOffer.galleryImages ?? []).length - 1,
                )}
                onImageDoubleClick={
                  (shopOffer.galleryImages ?? []).length > 0
                    ? () => openGallery(shopOffer)
                    : undefined
                }
              />
            : null}
          </div>
        </DialogContent>
      </Dialog>

      <SpotlightImageViewer viewer={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
