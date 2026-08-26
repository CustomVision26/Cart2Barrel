"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Package } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export function splitHubStockDescriptionFeatures(
  text: string,
): { title: string; detail?: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\u2022]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return lines.map((line) => {
    const parts = line.split(/\s+[–—-]\s+/);
    if (parts.length >= 2 && parts[0]) {
      return { title: parts[0], detail: parts.slice(1).join(" — ") };
    }
    return { title: line };
  });
}

export function HubStockMetaChips({
  sizeLabel,
  colorLabel,
}: {
  sizeLabel: string;
  colorLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5">
      <span className="rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 text-[11px] text-foreground">
        Size {sizeLabel}
      </span>
      <span className="rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 text-[11px] text-foreground">
        Color {colorLabel}
      </span>
    </div>
  );
}

export function HubStockFeatureList({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  const features = splitHubStockDescriptionFeatures(description);
  if (features.length === 0) return null;

  return (
    <ul className={cn("max-h-[28vh] space-y-2 overflow-y-auto pr-0.5", className)}>
      {features.map((feature, index) => (
        <li
          key={`${feature.title}-${index}`}
          className="flex gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both"
          style={{ animationDelay: `${80 + index * 70}ms`, animationDuration: "420ms" }}
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20">
            <CheckIcon className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-snug text-foreground">
              {feature.title}
            </p>
            {feature.detail ?
              <p className="text-xs leading-relaxed text-muted-foreground">
                {feature.detail}
              </p>
            : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HubStockProductHeroCarousel({
  productName,
  imageUrls,
  className,
}: {
  productName: string;
  imageUrls: string[];
  className?: string;
}) {
  const images = imageUrls.map((url) => url.trim()).filter(Boolean);
  const imageKey = images.join("|");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.scrollTo(0, false);
    setSlideIndex(0);
  }, [carouselApi, imageKey]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setSlideIndex(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <Package className="size-8" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Carousel
        className="w-full"
        opts={{ loop: images.length > 1 }}
        setApi={setCarouselApi}
      >
        <CarouselContent>
          {images.map((url, index) => (
            <CarouselItem key={`${url}-${index}`}>
              <div className="relative aspect-[4/3] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${productName} photo ${index + 1}`}
                  className="size-full object-contain motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-105 motion-safe:duration-700"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 ?
          <>
            <CarouselPrevious className="left-2 border-border/80 bg-background/90 shadow-md" />
            <CarouselNext className="right-2 border-border/80 bg-background/90 shadow-md" />
          </>
        : null}
      </Carousel>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent" />
      {images.length > 1 ?
        <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground shadow-sm backdrop-blur">
          {slideIndex + 1} / {images.length}
        </span>
      : null}
    </div>
  );
}
