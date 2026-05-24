"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 text-muted-foreground"
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
        "relative size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/20",
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
                      className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border/70 bg-muted/20"
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

export function ContainerCatalogChart({ rows }: ContainerCatalogChartProps) {
  const [slideshow, setSlideshow] = useState<SlideshowState | null>(null);

  return (
    <>
      <Card className="border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="font-heading text-base">Container options</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Barrels and bins you can add from Dashboard → Barrels. Each listing
            shows the container price before checkout. Double-click a photo to
            browse images.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ?
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
              Container options are being published. Sign in later or contact us
              for current barrel and bin availability.
            </p>
          : <div className="overflow-hidden rounded-lg border border-border/70">
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="w-10">Photo</span>
                <span>Container</span>
                <span className="text-right">Price</span>
              </div>
              <ul>
                {rows.map((row, index) => (
                  <li
                    key={row.id}
                    className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2.5 text-xs ${
                      index % 2 === 0 ? "bg-background/40" : "bg-muted/20"
                    }`}
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
                    <span className="shrink-0 text-right tabular-nums font-semibold text-primary">
                      {row.priceLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          }
        </CardContent>
      </Card>

      <ContainerImageSlideshow
        slideshow={slideshow}
        onClose={() => setSlideshow(null)}
      />
    </>
  );
}
