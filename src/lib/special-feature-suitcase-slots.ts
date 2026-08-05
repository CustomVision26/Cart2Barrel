import type { SpecialOfferSlotSummary } from "@/data/special-feature-suitcase-slots";

/** Shopper-facing slot label for promo banner / barrels UI. */
export function formatSpecialOfferSlotLabel(
  summary: SpecialOfferSlotSummary,
): string | null {
  if (summary.capacity == null || summary.remaining == null) return null;

  if (summary.isFull || summary.remaining <= 0) {
    return `Capacity reached · 0 of ${summary.capacity} slots left`;
  }

  return `${summary.remaining} of ${summary.capacity} suitcase slot${summary.capacity === 1 ? "" : "s"} left`;
}

/** Short marquee fragment for running banner chips. */
export function formatSpecialOfferSlotMarqueeFragment(
  summary: SpecialOfferSlotSummary,
): string | null {
  if (summary.capacity == null || summary.remaining == null) return null;

  if (summary.isFull || summary.remaining <= 0) {
    return "Sold out";
  }

  return `${summary.remaining}/${summary.capacity} slots left`;
}
