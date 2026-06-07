import type { BatchQuoteEstimate, ItemQuote } from "@/db/schema";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";

/** One bundled product's portion of a saved batch estimate (cents). */
export type BatchLineShare = {
  merchandise: number;
  serviceFee: number;
  shipping: number;
  tax: number;
  total: number;
};

/**
 * Divide a saved batch estimate across bundled lines, weighted by each line's
 * latest quote, so per-product shares sum back to the batch totals exactly.
 */
export function computeBatchLineShares(
  estimate: BatchQuoteEstimate,
  lineIds: string[],
  quoteForId: (id: string) => ItemQuote | null,
): Map<string, BatchLineShare> {
  const quotes = lineIds.map(quoteForId);
  const merch = allocateCentsByWeight(
    estimate.siteMerchandiseTotalCents,
    quotes.map((q) => q?.itemCost ?? 0),
  );
  const service = allocateCentsByWeight(
    estimate.serviceHandlingTotalCents,
    quotes.map((q) => q?.serviceFee ?? 0),
  );
  const shipping = allocateCentsByWeight(
    estimate.siteShippingTotalCents,
    quotes.map((q) => q?.estimatedShipping ?? 0),
  );
  const tax = allocateCentsByWeight(
    estimate.siteSaleTaxTotalCents,
    quotes.map((q) => (q ? lineSaleTaxCentsFromQuote(q) : 0)),
  );
  const map = new Map<string, BatchLineShare>();
  lineIds.forEach((id, i) => {
    map.set(id, {
      merchandise: merch[i] ?? 0,
      serviceFee: service[i] ?? 0,
      shipping: shipping[i] ?? 0,
      tax: tax[i] ?? 0,
      total:
        (merch[i] ?? 0) +
        (service[i] ?? 0) +
        (shipping[i] ?? 0) +
        (tax[i] ?? 0),
    });
  });
  return map;
}
