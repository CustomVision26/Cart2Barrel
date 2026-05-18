import type { CartLinePriceRow } from "@/components/dashboard/cart-line-price-breakdown";
import type { ItemQuote } from "@/db/schema";
import {
  formatUsd,
  serviceHandlingFeePerUnitCents,
  type MerchantServiceTierRow,
} from "@/lib/admin-markup";

/** Machine-readable pack metadata appended to outside-purchase staff notes. */
const OP_PACK_META_RE = /\[op-pack\]\s*unitsPerPack=(\d+)/i;

export type OutsidePurchaseServiceQuoteBreakdown = {
  unitPriceCents: number;
  /** Pack/case/bundle count when `isPackLine`; otherwise consumer unit count. */
  quantity: number;
  unitsPerPack: number;
  consumerUnits: number;
  perUnitServiceCents: number;
  serviceFeeCents: number;
  totalPriceCents: number;
  isPackLine: boolean;
};

/** Parses `Listed unit price for tier: $X.XX` from outside-purchase staff notes. */
export function parseListedUnitPriceCentsFromOutsidePurchaseStaffNote(
  staffNote: string | null | undefined,
): number | null {
  if (!staffNote?.trim()) return null;
  const m = staffNote.match(
    /Listed unit price for tier:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (!m?.[1]) return null;
  const dollars = Number.parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export function parseOutsidePurchaseUnitsPerPackFromStaffNote(
  staffNote: string | null | undefined,
): number | null {
  if (!staffNote?.trim()) return null;
  const m = staffNote.match(OP_PACK_META_RE);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 9999);
}

export function appendOutsidePurchasePackMetaToStaffNote(
  staffNote: string,
  unitsPerPack: number,
): string {
  if (unitsPerPack <= 1) return staffNote;
  const meta = `[op-pack] unitsPerPack=${unitsPerPack}`;
  return staffNote.trim() ? `${staffNote.trim()}\n\n${meta}` : meta;
}

/** Customer-facing outside-purchase line: service & handling only. */
export function computeOutsidePurchaseCustomerQuoteCents(params: {
  unitPriceCents: number;
  /** Pack count when pack line; consumer units when single-item line. */
  quantity: number;
  /** Consumer units included in one pack (1 = each item). */
  unitsPerPack?: number;
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
}): OutsidePurchaseServiceQuoteBreakdown {
  const packCount = Math.max(1, Math.min(999, Math.floor(params.quantity)));
  const unitsPerPack = Math.max(
    1,
    Math.min(9999, Math.floor(params.unitsPerPack ?? 1)),
  );
  const isPackLine = unitsPerPack > 1;
  const unitPriceCents = Math.max(0, Math.round(params.unitPriceCents));
  const perUnitServiceCents = serviceHandlingFeePerUnitCents(
    unitPriceCents,
    params.serviceTiers,
  );
  const consumerUnits = packCount * unitsPerPack;
  const serviceFeeCents = perUnitServiceCents * consumerUnits;
  return {
    unitPriceCents,
    quantity: packCount,
    unitsPerPack,
    consumerUnits,
    perUnitServiceCents,
    serviceFeeCents,
    totalPriceCents: serviceFeeCents,
    isPackLine,
  };
}

export function outsidePurchaseQuoteSummaryRows(
  quote: Pick<
    ItemQuote,
    "serviceFee" | "requestQuantity" | "totalPrice" | "staffNote"
  >,
  breakdown?: Pick<
    OutsidePurchaseServiceQuoteBreakdown,
    "perUnitServiceCents" | "quantity" | "unitsPerPack" | "consumerUnits" | "isPackLine"
  >,
): CartLinePriceRow[] {
  const packCount = breakdown?.quantity ?? quote.requestQuantity ?? 1;
  const unitsPerPack =
    breakdown?.unitsPerPack ??
    parseOutsidePurchaseUnitsPerPackFromStaffNote(quote.staffNote) ??
    1;
  const consumerUnits =
    breakdown?.consumerUnits ?? Math.max(1, packCount * unitsPerPack);
  const isPackLine = breakdown?.isPackLine ?? unitsPerPack > 1;
  const perUnitResolved =
    breakdown?.perUnitServiceCents ??
    (consumerUnits > 0 ?
      Math.round(quote.serviceFee / consumerUnits)
    : quote.serviceFee);

  const packDetail =
    isPackLine ?
      `${formatUsd(perUnitResolved)}/unit × ${unitsPerPack} per pack × ${packCount} pack${packCount === 1 ? "" : "s"}`
    : consumerUnits > 1 ?
      `× ${consumerUnits} units`
    : undefined;

  return [
    {
      label: "Service & handling (per unit)",
      amountCents: perUnitResolved,
      detail: packDetail,
    },
    {
      label: "Amount due",
      amountCents: quote.totalPrice,
      emphasis: true,
    },
  ];
}
