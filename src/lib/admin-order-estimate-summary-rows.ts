import type { CartLinePriceRow } from "@/components/dashboard/cart-line-price-breakdown";
import type { BatchQuoteEstimate, ItemQuote } from "@/db/schema";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";

/** Checkout-style batch roll-up (matches cart batch bundle / charge preview). */
export function batchEstimateSummaryRows(
  estimate: BatchQuoteEstimate,
): CartLinePriceRow[] {
  return [
    {
      label: "Site merchandise",
      amountCents: estimate.siteMerchandiseTotalCents,
    },
    {
      label: "Service & handling",
      amountCents: estimate.serviceHandlingTotalCents,
    },
    {
      label: "Site shipping",
      amountCents: estimate.siteShippingTotalCents,
    },
    {
      label: "Site sale tax",
      amountCents: estimate.siteSaleTaxTotalCents,
    },
    {
      label: "Batch subtotal (checkout)",
      amountCents: estimate.subtotalCents,
      emphasis: true,
    },
  ];
}

/** Per-product share of a batch estimate (matches checkout charge preview labels). */
export function batchLineShareSummaryRows(share: BatchLineShare): CartLinePriceRow[] {
  return [
    { label: "Site merchandise", amountCents: share.merchandise },
    { label: "Service & handling", amountCents: share.serviceFee },
    { label: "Site shipping", amountCents: share.shipping },
    { label: "Site sale tax", amountCents: share.tax },
    {
      label: "Product total (checkout)",
      amountCents: share.total,
      emphasis: true,
    },
  ];
}

/** Single-line operational quote (matches cart quoted item breakdown). */
export function singleQuoteSummaryRows(quote: ItemQuote): CartLinePriceRow[] {
  const rows: CartLinePriceRow[] = [
    { label: "Item cost", amountCents: quote.itemCost },
    { label: "Service & handling", amountCents: quote.serviceFee },
    { label: "Est. shipping", amountCents: quote.estimatedShipping },
    { label: "Tax", amountCents: lineSaleTaxCentsFromQuote(quote) },
    {
      label: "Line estimate",
      amountCents: quote.totalPrice,
      emphasis: true,
    },
  ];
  return rows;
}
