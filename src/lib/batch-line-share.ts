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

/**
 * Scale a component share so it sums exactly to the charged checkout line
 * (batch subtotal is allocated by quote totals at checkout; component shares
 * can otherwise disagree by a few cents or more).
 */
export function alignBatchShareToChargedCents(
  share: BatchLineShare,
  chargedCents: number,
): BatchLineShare {
  const charged = Math.max(0, Math.round(chargedCents));
  const current = share.total;
  if (current === charged) {
    return { ...share, total: charged };
  }
  if (current <= 0) {
    return {
      merchandise: charged,
      serviceFee: 0,
      shipping: 0,
      tax: 0,
      total: charged,
    };
  }

  const scaled = {
    merchandise: Math.round((share.merchandise * charged) / current),
    serviceFee: Math.round((share.serviceFee * charged) / current),
    shipping: Math.round((share.shipping * charged) / current),
    tax: Math.round((share.tax * charged) / current),
  };
  const sum =
    scaled.merchandise + scaled.serviceFee + scaled.shipping + scaled.tax;
  const delta = charged - sum;
  const keys = [
    "merchandise",
    "serviceFee",
    "shipping",
    "tax",
  ] as const satisfies ReadonlyArray<keyof typeof scaled>;
  let largest: (typeof keys)[number] = keys[0];
  for (const key of keys) {
    if (scaled[key] > scaled[largest]) largest = key;
  }
  scaled[largest] += delta;
  return { ...scaled, total: charged };
}
