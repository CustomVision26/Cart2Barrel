import { cn } from "@/lib/utils";

/** Large square arrows for the outer category carousel. */
export function spotlightCategoryCarouselNavButtonClass(side: "left" | "right") {
  return cn(
    "z-10 rounded-xl border-2 border-primary bg-primary text-primary-foreground shadow-lg",
    "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
    "hover:bg-primary/90 hover:ring-primary/50",
    "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50 disabled:ring-0 disabled:ring-offset-0",
    side === "left" ? "left-0 sm:-left-2" : "right-0 sm:-right-2",
    "size-14 sm:size-16",
  );
}

/** Compact chevron arrows for in-card product slides. */
export function spotlightProductCarouselNavButtonClass(side: "left" | "right") {
  return cn(
    "z-10 rounded-full border border-border/80 bg-background/95 text-foreground shadow-sm backdrop-blur",
    "hover:border-primary/50 hover:bg-muted hover:text-primary",
    "disabled:opacity-40",
    side === "left" ? "left-0 sm:-left-0.5" : "right-0 sm:-right-0.5",
    "size-7 sm:size-8",
  );
}
