"use client";

import { Container, ImageIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { PricingOverviewSection } from "@/components/marketing/how-it-works-pricing-overview";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ContainerCatalogChartImage,
  ContainerCatalogChartRow,
} from "@/lib/container-packing-fee-chart";
import { cn } from "@/lib/utils";

type ContainerCatalogChartProps = {
  rows: ContainerCatalogChartRow[];
  index?: number;
};

type SlideshowState = {
  containerLabel: string;
  images: ContainerCatalogChartImage[];
};

function ContainerThumbnail({
  images,
  containerLabel,
  onOpenSlideshow,
}: {
  images: ContainerCatalogChartImage[];
  containerLabel: string;
  onOpenSlideshow: () => void;
}) {
  const primary = images[0];

  if (!primary) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border/70 bg-muted text-muted-foreground"
        aria-hidden
      >
        <ImageIcon className="size-4" />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "relative size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted",
        "ring-offset-background transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      title="Double-click to view photos"
      aria-label={`View photos for ${containerLabel}`}
      onDoubleClick={(event) => {
        event.preventDefault();
        onOpenSlideshow();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={primary.imageUrl}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {images.length > 1 ?
        <span className="absolute right-0.5 bottom-0.5 rounded bg-background/90 px-1 text-[9px] font-semibold tabular-nums text-foreground ring-1 ring-border/60">
          +{images.length - 1}
        </span>
      : null}
    </button>
  );
}

function ContainerImageSlideshow({
  slideshow,
  onClose,
}: {
  slideshow: SlideshowState | null;
  onClose: () => void;
}) {
  const images = slideshow?.images ?? [];

  return (
    <Dialog open={slideshow != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-base leading-snug">
            {slideshow?.containerLabel}
          </DialogTitle>
          <DialogDescription>
            {images.length > 1 ?
              `${images.length} photos — use arrows or swipe to browse.`
            : "Container photo."}
          </DialogDescription>
        </DialogHeader>
        {images.length > 0 ?
          <div className="relative px-10">
            <Carousel className="w-full" opts={{ loop: images.length > 1 }}>
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={image.id}>
                    <div
                      className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border/70 bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.imageUrl}
                        alt={`${slideshow?.containerLabel ?? "Container"} photo ${index + 1}`}
                        className="size-full object-contain"
                      />
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

export function ContainerCatalogChart({
  rows,
  index = 3,
}: ContainerCatalogChartProps) {
  const [slideshow, setSlideshow] = useState<SlideshowState | null>(null);

  return (
    <>
      <PricingOverviewSection
        index={index}
        icon={<Container className="size-4" />}
        title="Container options"
        description="Barrels and bins you can add from Dashboard → Barrels. Each listing shows the container price before checkout. Double-click a photo to browse images."
        accent="violet"
      >
        {rows.length === 0 ?
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/50 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
            Container options are being published. Sign in later or contact us
            for current barrel and bin availability.
          </p>
        : <div className="pricing-overview-ledger overflow-hidden rounded-lg">
            <div className="pricing-overview-ledger-head grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <span className="w-10">Photo</span>
              <span>Container</span>
              <span className="text-right">Price</span>
            </div>
            <ul>
              {rows.map((row, rowIndex) => (
                <li
                  key={row.id}
                  className="pricing-overview-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs transition-colors"
                  style={
                    {
                      "--pricing-row-index": rowIndex,
                    } as CSSProperties
                  }
                >
                  <ContainerThumbnail
                    images={row.images}
                    containerLabel={row.containerLabel}
                    onOpenSlideshow={() =>
                      setSlideshow({
                        containerLabel: row.containerLabel,
                        images: row.images,
                      })
                    }
                  />
                  <span className="min-w-0 font-medium text-foreground">
                    {row.containerLabel}
                  </span>
                  <span className="pricing-overview-fee shrink-0 text-right tabular-nums font-semibold">
                    {row.priceLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      </PricingOverviewSection>

      <ContainerImageSlideshow
        slideshow={slideshow}
        onClose={() => setSlideshow(null)}
      />
    </>
  );
}
