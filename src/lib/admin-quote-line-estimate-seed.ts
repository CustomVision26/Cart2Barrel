import type { AdminAiEstimateSuccess } from "@/actions/admin-ai-estimate";
import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import { hostnameFromProductUrl } from "@/lib/site-name";

export function lineTaxCentsFromQuote(line: AdminQuoteHistoryLine): number {
  const q = line.quote;
  const pack = q.packingFeeCents ?? 0;
  return Math.max(
    0,
    q.totalPrice - q.itemCost - q.serviceFee - q.estimatedShipping - pack
  );
}

/** Build a synthetic AI-estimate shape so the shared estimate UI can edit an existing quote. */
export function adminQuoteLineToEstimateSeed(
  line: AdminQuoteHistoryLine
): AdminAiEstimateSuccess {
  const tax = lineTaxCentsFromQuote(line);
  const savings = line.quote.merchandiseSavingsCents ?? 0;
  const packBundle = line.quote.itemCost + savings;
  const packCount = Math.max(1, line.request.quantity);
  const unitPackCents =
    packBundle > 0 ? Math.round(packBundle / packCount) : 0;

  return {
    ok: true,
    extraction: {
      productName: line.request.productName?.trim() || null,
      siteName:
        line.request.siteName?.trim() ||
        hostnameFromProductUrl(line.request.productUrl),
      unitPriceUsd: unitPackCents > 0 ? unitPackCents / 100 : null,
      productImageUrl: line.request.productImageUrl?.trim() || null,
      color: line.request.productColor?.trim() || null,
      size: line.request.productSize?.trim() || null,
      notes: null,
    },
    unitPriceCents: unitPackCents > 0 ? unitPackCents : null,
    estimate: {
      quantity: line.request.quantity,
      unitPriceCents: unitPackCents > 0 ? unitPackCents : null,
      merchandiseSubtotalCents: line.quote.itemCost,
      serviceFeeCents: line.quote.serviceFee,
      packingFeeCents: line.quote.packingFeeCents ?? 0,
      estimatedShippingCents: line.quote.estimatedShipping,
      taxCents: tax,
      totalCents: line.quote.totalPrice,
    },
    settings: { taxBps: 0, defaultShippingCents: 0 },
  };
}

export function packPriceDollarsFromQuoteLine(line: AdminQuoteHistoryLine): string {
  const savings = line.quote.merchandiseSavingsCents ?? 0;
  const packBundle = line.quote.itemCost + savings;
  const packCount = Math.max(1, line.request.quantity);
  const unitPackCents =
    packBundle > 0 ? Math.round(packBundle / packCount) : 0;
  return (unitPackCents / 100).toFixed(2);
}

export function savingsDollarsFromQuoteLine(line: AdminQuoteHistoryLine): string {
  const cents = line.quote.merchandiseSavingsCents ?? 0;
  return (cents / 100).toFixed(2);
}
