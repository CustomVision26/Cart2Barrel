"use client";

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import {
  spotlightCategoryCarouselNavButtonClass,
  spotlightProductCarouselNavButtonClass,
} from "@/components/marketing/spotlight-carousel-nav-styles";
import { CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

/** Large square arrows for the outer category carousel. */
export function SpotlightCategoryCarouselPrevious() {
  return (
    <CarouselPrevious
      variant="default"
      className={spotlightCategoryCarouselNavButtonClass("left")}
    >
      <ArrowLeft className="size-8 stroke-[2.5] sm:size-9" aria-hidden />
    </CarouselPrevious>
  );
}

export function SpotlightCategoryCarouselNext() {
  return (
    <CarouselNext
      variant="default"
      className={spotlightCategoryCarouselNavButtonClass("right")}
    >
      <ArrowRight className="size-8 stroke-[2.5] sm:size-9" aria-hidden />
    </CarouselNext>
  );
}

/** Compact chevron arrows for in-card product slides. */
export function SpotlightProductCarouselPrevious() {
  return (
    <CarouselPrevious
      variant="outline"
      className={spotlightProductCarouselNavButtonClass("left")}
    >
      <ChevronLeft className="size-3.5" aria-hidden />
    </CarouselPrevious>
  );
}

export function SpotlightProductCarouselNext() {
  return (
    <CarouselNext
      variant="outline"
      className={spotlightProductCarouselNavButtonClass("right")}
    >
      <ChevronRight className="size-3.5" aria-hidden />
    </CarouselNext>
  );
}
