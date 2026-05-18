import type { CartLinePriceRow } from "@/components/dashboard/cart-line-price-breakdown";
import type { BatchQuoteEstimate, ItemQuote } from "@/db/schema";
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
