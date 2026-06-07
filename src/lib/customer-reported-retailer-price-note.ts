import { parseUsdToCents } from "@/lib/admin-pricing-form-utils";

const CUSTOMER_PRICE_LINE =
  /^Customer-reported retailer unit price:\s*(\$[\d,]+\.\d{2})\s*\(qty\s*(\d+)\)\./;

export type CustomerReportedRetailerPrice = {
  unitPriceCents: number;
  quantity: number;
  merchandiseSubtotalCents: number;
};

/** Parses the auto-prefixed price line stored on item request notes at submission. */
export function parseCustomerReportedRetailerPriceFromNote(
  note: string | null | undefined,
): CustomerReportedRetailerPrice | null {
  if (!note?.trim()) return null;
  const match = note.trim().match(CUSTOMER_PRICE_LINE);
  if (!match) return null;
  const unitPriceCents = parseUsdToCents(match[1] ?? "");
  const quantity = Number.parseInt(match[2] ?? "", 10);
  if (unitPriceCents <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return {
    unitPriceCents,
    quantity,
    merchandiseSubtotalCents: unitPriceCents * quantity,
  };
}

/** Returns the customer-written note with the auto price prefix removed. */
export function customerNoteWithoutReportedPrice(
  note: string | null | undefined,
): string | null {
  if (!note?.trim()) return null;
  const stripped = note
    .trim()
    .replace(
      /^Customer-reported retailer unit price:\s*\$[\d,]+\.\d{2}\s*\(qty\s*\d+\)\.\s*(\n\n)?/,
      "",
    )
    .trim();
  return stripped.length > 0 ? stripped : null;
}
