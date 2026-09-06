import {
  computePackLineMerchandiseAndServiceCents,
  formatUsd,
  serviceHandlingFeePerUnitCents,
  type MerchantServiceTierRow,
} from "@/lib/admin-markup";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import type { OrderItemMerchandiseReconciliationStatus } from "@/db/schema";

/** Parse "12 Cans", "12-pack", "Pack of 12", etc. from a product title. */
export function inferUnitsPerPackFromProductLabel(
  label: string | null | undefined,
): number | null {
  const s = label?.trim() ?? "";
  if (!s) return null;
  const patterns = [
    /\bpack\s+of\s+(\d+)\b/i,
    /\b(\d+)\s*-\s*packs?\b/i,
    /\b(\d+)\s*packs?\b/i,
    /\b(\d+)\s*cans?\b/i,
    /\b(\d+)\s*ct\b/i,
    /\b(\d+)\s*count\b/i,
    /\((\d+)\s*(?:ct|count|pk|pack)?\)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m?.[1]) continue;
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 2 && n <= 9999) return n;
  }
  return null;
}

/**
 * Recover units-per-pack from checkout S&H using quote pack math
 * (tier from pack÷units × units). e.g. $39.99 + $3.60 → 12.
 */
export function inferUnitsPerPackFromCheckoutService(params: {
  packCount: number;
  checkoutMerchandiseCents: number;
  checkoutServiceCents: number;
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
}): number | null {
  const packCount = Math.max(0, Math.floor(params.packCount));
  const checkoutMerch = Math.max(0, Math.round(params.checkoutMerchandiseCents));
  const checkoutService = Math.max(0, Math.round(params.checkoutServiceCents));
  if (packCount <= 0 || checkoutMerch <= 0 || checkoutService <= 0) return null;

  const packPriceCents = Math.round(checkoutMerch / packCount);
  for (let upp = 2; upp <= 48; upp++) {
    const fee = computePackLineMerchandiseAndServiceCents({
      packPriceCents,
      packCount,
      unitsPerPack: upp,
      serviceTiers: params.serviceTiers,
    }).serviceFeeCents;
    if (fee === checkoutService) return upp;
  }
  return null;
}

/** Resolve consumer units per pack for reconciliation S&H. */
export function resolveReconciliationUnitsPerPack(params: {
  unitsPerPack?: number | null;
  productName?: string | null;
  packCount: number;
  checkoutMerchandiseCents: number;
  checkoutServiceCents: number;
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
}): number {
  const explicit = Math.floor(Number(params.unitsPerPack) || 0);
  if (explicit >= 2) return Math.min(9999, explicit);
  const fromName = inferUnitsPerPackFromProductLabel(params.productName);
  if (fromName) return fromName;
  const fromCheckout = inferUnitsPerPackFromCheckoutService({
    packCount: params.packCount,
    checkoutMerchandiseCents: params.checkoutMerchandiseCents,
    checkoutServiceCents: params.checkoutServiceCents,
    serviceTiers: params.serviceTiers,
  });
  if (fromCheckout) return fromCheckout;
  return 1;
}

export const MERCHANDISE_TOPUP_DEFAULT_EXPIRY_HOURS = 48;

export type ReconciliationChargeBreakdown = {
  merchandiseCents: number;
  shippingCents: number;
  taxCents: number;
  serviceCents: number;
};

export type MerchandiseReconciliationView = {
  id: string;
  orderItemId: string;
  clerkUserId: string;
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents: number;
  deltaCents: number;
  status: OrderItemMerchandiseReconciliationStatus;
  supportTicketId: string | null;
  customerMessage: string | null;
  topupAmountCents: number | null;
  topupExpiresAt: string | null;
  topupPaidAt: string | null;
  /** Cart checkout order that collected this top-up, when paid via Stripe. */
  topupCheckoutOrderId: string | null;
  /** Cents already refunded from the top-up checkout payment. */
  topupRefundedCents: number;
  /** Cumulative top-up cents collected across add-on checkouts. */
  topupPaidTotalCents: number;
  resolvedAt: string | null;
};

/** Net top-up already collected (paid total − refunds). */
export function merchandiseTopupPaidNetCents(row: {
  topupPaidTotalCents?: number | null;
  topupAmountCents?: number | null;
  topupPaidAt?: string | null;
  topupRefundedCents?: number | null;
}): number {
  const paidTotal = Math.max(
    0,
    row.topupPaidTotalCents ??
      (row.topupPaidAt ? Math.max(0, row.topupAmountCents ?? 0) : 0),
  );
  return Math.max(0, paidTotal - Math.max(0, row.topupRefundedCents ?? 0));
}

/**
 * Amount still due after prior paid top-ups.
 * Price-down (negative gross) is returned unchanged.
 */
export function remainingMerchandiseTopupCents(params: {
  grossDeltaCents: number;
  paidNetCents: number;
}): number {
  const gross = Math.round(params.grossDeltaCents);
  if (gross <= 0) return gross;
  return Math.max(0, gross - Math.max(0, Math.round(params.paidNetCents)));
}

export function reconciliationChargeTotalCents(
  b: ReconciliationChargeBreakdown,
): number {
  return (
    b.merchandiseCents + b.shippingCents + b.taxCents + b.serviceCents
  );
}

export function checkoutRetailerVariableCents(params: {
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents?: number;
}): number {
  return reconciliationChargeTotalCents({
    merchandiseCents: params.checkoutMerchandiseCents,
    shippingCents: params.checkoutShippingCents,
    taxCents: params.checkoutTaxCents,
    serviceCents: params.checkoutServiceCents ?? 0,
  });
}

export function actualRetailerVariableCents(params: {
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents?: number;
}): number {
  return reconciliationChargeTotalCents({
    merchandiseCents: params.actualMerchandiseCents,
    shippingCents: params.actualShippingCents,
    taxCents: params.actualTaxCents,
    serviceCents: params.actualServiceCents ?? 0,
  });
}

export function retailerVariableDeltaCents(params: {
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents?: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents?: number;
}): number {
  return (
    actualRetailerVariableCents(params) - checkoutRetailerVariableCents(params)
  );
}

/**
 * Single-product (or pack) tier suggestion.
 * - unitsPerPack = 1: tier(merch ÷ pack qty) × pack qty
 * - unitsPerPack > 1: tier(pack price) × (pack qty × units per pack)
 *   e.g. $45 pack of 12 → $1.50 × 12 = $18 (customer tops up vs checkout S&H)
 */
export function computeAdjustedServiceHandlingCents(params: {
  checkoutMerchandiseCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  /** Number of packs / order-line quantity. */
  quantity?: number;
  /** Consumer units inside one pack (12 for a 12-can case). */
  unitsPerPack?: number;
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
}): number {
  const actualMerch = Math.max(0, Math.round(params.actualMerchandiseCents));
  const checkoutMerch = Math.max(0, Math.round(params.checkoutMerchandiseCents));
  const checkoutService = Math.max(0, Math.round(params.checkoutServiceCents));
  const packCount =
    params.quantity != null ? Math.max(0, Math.floor(params.quantity)) : 0;
  const unitsPerPack = Math.max(
    1,
    Math.min(9999, Math.floor(params.unitsPerPack ?? 1) || 1),
  );

  if (packCount > 0) {
    const packPriceCents = Math.round(actualMerch / packCount);
    if (packPriceCents <= 0) return 0;
    // Band from pack/line price; multiply by all consumer units in the packs.
    const consumerUnits = packCount * unitsPerPack;
    return Math.round(
      serviceHandlingFeePerUnitCents(packPriceCents, params.serviceTiers) *
        consumerUnits,
    );
  }

  if (checkoutMerch <= 0) return checkoutService;
  return Math.round((checkoutService * actualMerch) / checkoutMerch);
}

export type BatchServiceHandlingLineInput = {
  quantity: number;
  /** Checkout merchandise share for this product (weight for allocating actual merch). */
  checkoutMerchandiseCents: number;
  unitsPerPack?: number;
  productName?: string | null;
  checkoutServiceCents?: number;
};

/**
 * Batch S&H from each product’s pack qty + units-per-pack tier math.
 * Actual merchandise is split across lines by checkout merchandise weights.
 */
export function computeBatchAdjustedServiceHandlingCents(params: {
  lines: BatchServiceHandlingLineInput[];
  actualMerchandiseCents: number;
  serviceTiers?: readonly MerchantServiceTierRow[] | null;
}): number {
  const lines = params.lines.filter((l) => Math.max(0, Math.floor(l.quantity)) > 0);
  if (lines.length === 0) return 0;

  const actualMerch = Math.max(0, Math.round(params.actualMerchandiseCents));
  const weights = lines.map((l) => Math.max(0, l.checkoutMerchandiseCents));
  const allocated = allocateCentsByWeight(actualMerch, weights);

  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const packCount = Math.max(0, Math.floor(line.quantity));
    const lineMerch = allocated[i] ?? 0;
    if (packCount <= 0 || lineMerch <= 0) continue;
    const unitsPerPack = resolveReconciliationUnitsPerPack({
      unitsPerPack: line.unitsPerPack,
      productName: line.productName,
      packCount,
      checkoutMerchandiseCents: line.checkoutMerchandiseCents,
      checkoutServiceCents: line.checkoutServiceCents ?? 0,
      serviceTiers: params.serviceTiers,
    });
    total += computeAdjustedServiceHandlingCents({
      checkoutMerchandiseCents: line.checkoutMerchandiseCents,
      checkoutServiceCents: line.checkoutServiceCents ?? 0,
      actualMerchandiseCents: lineMerch,
      quantity: packCount,
      unitsPerPack,
      serviceTiers: params.serviceTiers,
    });
  }
  return total;
}

export type ReconciliationChargeRowKey =
  | "merchandise"
  | "service"
  | "shipping"
  | "tax";

export function availableReconciliationChargeRows(
  checkout: ReconciliationChargeBreakdown,
  actual: ReconciliationChargeBreakdown,
): Array<{
  key: ReconciliationChargeRowKey;
  label: string;
  checkoutCents: number;
  actualCents: number;
}> {
  const candidates: Array<{
    key: ReconciliationChargeRowKey;
    label: string;
    checkoutCents: number;
    actualCents: number;
  }> = [
    {
      key: "merchandise",
      label: "Merchandise",
      checkoutCents: checkout.merchandiseCents,
      actualCents: actual.merchandiseCents,
    },
    {
      key: "service",
      label: "Service & handling",
      checkoutCents: checkout.serviceCents,
      actualCents: actual.serviceCents,
    },
    {
      key: "shipping",
      label: "Shipping",
      checkoutCents: checkout.shippingCents,
      actualCents: actual.shippingCents,
    },
    {
      key: "tax",
      label: "Sales tax",
      checkoutCents: checkout.taxCents,
      actualCents: actual.taxCents,
    },
  ];
  // Always show sales tax so staff can enter actual tax even when checkout tax was $0.
  return candidates.filter(
    (r) => r.key === "tax" || r.checkoutCents > 0 || r.actualCents > 0,
  );
}

/** Per-line checkout → actual deltas (what makes up a top-up / still-due figure). */
export function reconciliationComponentDeltaRows(
  checkout: ReconciliationChargeBreakdown,
  actual: ReconciliationChargeBreakdown,
): Array<{
  key: ReconciliationChargeRowKey;
  label: string;
  checkoutCents: number;
  actualCents: number;
  deltaCents: number;
}> {
  return availableReconciliationChargeRows(checkout, actual).map((r) => ({
    ...r,
    deltaCents: r.actualCents - r.checkoutCents,
  }));
}

/** One product row for the Message customer prefill body. */
export type ReconciliationProductLineInput = {
  productName: string;
  /** Order line / product number (typically `orderItemId`). */
  productNumber?: string | null;
  quantity?: number | null;
  sizeLabel?: string | null;
  colorLabel?: string | null;
  /** Checkout merchandise share — used to allocate actual batch merch for S&H tiers. */
  checkoutMerchandiseCents?: number | null;
  /** Per-product checkout shares (batch messages). */
  checkoutShippingCents?: number | null;
  checkoutTaxCents?: number | null;
  checkoutServiceCents?: number | null;
  /** Consumer units inside one pack (e.g. 12 for a 12-can case). */
  unitsPerPack?: number | null;
};

/** Checkout charge breakdown for one batch product line. */
export function productCheckoutChargeBreakdown(
  product: ReconciliationProductLineInput,
): ReconciliationChargeBreakdown {
  return {
    merchandiseCents: Math.max(0, Math.round(product.checkoutMerchandiseCents ?? 0)),
    shippingCents: Math.max(0, Math.round(product.checkoutShippingCents ?? 0)),
    taxCents: Math.max(0, Math.round(product.checkoutTaxCents ?? 0)),
    serviceCents: Math.max(0, Math.round(product.checkoutServiceCents ?? 0)),
  };
}

/**
 * Split batch actual totals across products by each line's matching checkout
 * component (falls back to merchandise weight when a component is all zeros).
 */
export function allocateBatchActualChargesToProducts(
  products: ReconciliationProductLineInput[],
  actual: ReconciliationChargeBreakdown,
): ReconciliationChargeBreakdown[] {
  if (products.length === 0) return [];
  const merchWeights = products.map((p) =>
    Math.max(0, p.checkoutMerchandiseCents ?? 0),
  );
  const shipWeights = products.map((p) =>
    Math.max(0, p.checkoutShippingCents ?? 0),
  );
  const taxWeights = products.map((p) => Math.max(0, p.checkoutTaxCents ?? 0));
  const serviceWeights = products.map((p) =>
    Math.max(0, p.checkoutServiceCents ?? 0),
  );
  const weightOrMerch = (weights: number[]) =>
    weights.some((w) => w > 0) ? weights : merchWeights;

  const merch = allocateCentsByWeight(
    Math.max(0, Math.round(actual.merchandiseCents)),
    merchWeights,
  );
  const ship = allocateCentsByWeight(
    Math.max(0, Math.round(actual.shippingCents)),
    weightOrMerch(shipWeights),
  );
  const tax = allocateCentsByWeight(
    Math.max(0, Math.round(actual.taxCents)),
    weightOrMerch(taxWeights),
  );
  const service = allocateCentsByWeight(
    Math.max(0, Math.round(actual.serviceCents)),
    weightOrMerch(serviceWeights),
  );

  return products.map((_, i) => ({
    merchandiseCents: merch[i] ?? 0,
    shippingCents: ship[i] ?? 0,
    taxCents: tax[i] ?? 0,
    serviceCents: service[i] ?? 0,
  }));
}

function appendChargeSection(
  lines: string[],
  heading: string,
  rows: Array<{
    key: ReconciliationChargeRowKey;
    label: string;
    amountCents: number;
    note?: string;
  }>,
  subtotalCents: number,
): void {
  lines.push(heading);
  for (const r of rows) {
    const note = r.note ? ` ${r.note}` : "";
    lines.push(`• ${r.label}: ${formatUsd(r.amountCents)}${note}`);
  }
  if (rows.length > 0) {
    lines.push(`• Subtotal: ${formatUsd(subtotalCents)}`);
  }
}

/** Multi-line product block for the customer message body. */
export function formatReconciliationProductBlock(
  line: ReconciliationProductLineInput,
  index?: number,
): string[] {
  const name = line.productName.trim() || "Unnamed product";
  const title = index != null ? `${index}. ${name}` : name;
  const indent = "  ";
  const out: string[] = [title];
  const productNumber = line.productNumber?.trim();
  if (productNumber) {
    out.push(`${indent}Product #: ${productNumber}`);
  }
  if (line.quantity != null && Number.isFinite(line.quantity) && line.quantity > 0) {
    out.push(`${indent}Qty: ${Math.floor(line.quantity)}`);
  }
  const size = line.sizeLabel?.trim();
  if (size) {
    out.push(`${indent}Size: ${size}`);
  }
  const color = line.colorLabel?.trim();
  if (color) {
    out.push(`${indent}Color: ${color}`);
  }
  return out;
}

/** @deprecated Prefer structured `products` + formatReconciliationProductBlock. */
export function formatReconciliationProductLine(
  line: ReconciliationProductLineInput,
): string {
  return formatReconciliationProductBlock(line).join("\n");
}

function customerGreetingFirstName(customerName?: string | null): string | null {
  const trimmed = customerName?.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim();
  return first || null;
}

function appendDeltaClosing(
  lines: string[],
  delta: number,
  opts?: { paidTopupCents?: number; checkoutTotalCents?: number },
): void {
  const paidTopup = Math.max(0, opts?.paidTopupCents ?? 0);
  const checkoutTotal = Math.max(0, opts?.checkoutTotalCents ?? 0);
  if (paidTopup > 0 && checkoutTotal > 0) {
    lines.push(`Already paid via top-up: ${formatUsd(paidTopup)}`);
    lines.push(
      `New total after top-up: ${formatUsd(checkoutTotal + paidTopup)}`,
    );
    lines.push("");
  }
  if (delta > 0) {
    lines.push(
      paidTopup > 0 ?
        `Additional difference: +${formatUsd(delta)}`
      : `Difference: +${formatUsd(delta)}`,
    );
    lines.push("");
    lines.push(...formatMerchandisePriceDecisionPromptLines());
  } else if (delta < 0) {
    lines.push(
      paidTopup > 0 ?
        `Credit vs new total: −${formatUsd(Math.abs(delta))}`
      : `Difference: −${formatUsd(Math.abs(delta))}`,
    );
    lines.push("");
    lines.push(
      "Per our policy we will not purchase and will cancel with a refund. Refunds usually appear on your original payment method within 5–10 business days after processing.",
    );
  } else {
    lines.push(
      paidTopup > 0 ?
        "These charges are covered by your checkout payment plus the top-up already paid. We can proceed with the purchase."
      : "These charges match what you paid at checkout. We can proceed with the purchase.",
    );
  }
}

function appendChargeComparison(
  lines: string[],
  checkout: ReconciliationChargeBreakdown,
  actual: ReconciliationChargeBreakdown,
): void {
  const rows = availableReconciliationChargeRows(checkout, actual);
  const checkoutTotal = reconciliationChargeTotalCents(checkout);
  const actualTotal = reconciliationChargeTotalCents(actual);
  appendChargeSection(
    lines,
    "After checkout you paid",
    rows.map((r) => ({
      key: r.key,
      label: r.label,
      amountCents: r.checkoutCents,
    })),
    checkoutTotal,
  );
  lines.push("");
  appendChargeSection(
    lines,
    "At purchasing, updated charges are",
    rows.map((r) => ({
      key: r.key,
      label: r.label,
      amountCents: r.actualCents,
      note:
        r.key === "service" && r.actualCents !== r.checkoutCents ?
          "(adjusted from merchandise)"
        : undefined,
    })),
    actualTotal,
  );
}

/** Single checkout product — one product block + charge comparison. */
export function buildSingleReconciliationCustomerMessage(params: {
  productName: string;
  customerName?: string | null;
  products?: ReconciliationProductLineInput[];
  productLines?: string[];
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
  /** Prior paid top-up(s); difference line uses remaining due. */
  paidTopupCents?: number;
}): string {
  const label = params.productName.trim() || "your product";
  const checkoutTotal = reconciliationChargeTotalCents(params.checkout);
  const actualTotal = reconciliationChargeTotalCents(params.actual);
  const grossDelta = actualTotal - checkoutTotal;
  const delta = remainingMerchandiseTopupCents({
    grossDeltaCents: grossDelta,
    paidNetCents: params.paidTopupCents ?? 0,
  });

  const lines: string[] = [];
  const firstName = customerGreetingFirstName(params.customerName);
  lines.push(
    firstName ?
      `Hi ${firstName} — we're contacting you about ${label}.`
    : `Hi — we're contacting you about ${label}.`,
  );
  lines.push("");

  const products =
    params.products && params.products.length > 0 ? params.products : null;

  if (products) {
    lines.push("Product");
    lines.push("");
    const product = products[0]!;
    lines.push(...formatReconciliationProductBlock(product));
    lines.push("");
  } else if (params.productLines && params.productLines.length > 0) {
    lines.push("Product");
    lines.push("");
    for (const p of params.productLines) {
      const t = p.trim();
      if (!t) continue;
      for (const [idx, part] of t.split("\n").entries()) {
        lines.push(
          idx === 0 ?
            part.startsWith("•") || /^\d+\./.test(part) ?
              part
            : `• ${part}`
          : part,
        );
      }
      lines.push("");
    }
  }

  appendChargeComparison(lines, params.checkout, params.actual);
  lines.push("");
  appendDeltaClosing(lines, delta, {
    paidTopupCents: params.paidTopupCents,
    checkoutTotalCents: checkoutTotal,
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Batch checkout — each product gets its own identity + checkout vs updated
 * charges (actuals allocated by checkout shares), then one batch difference.
 */
export function buildBatchReconciliationCustomerMessage(params: {
  productName: string;
  customerName?: string | null;
  products: ReconciliationProductLineInput[];
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
  paidTopupCents?: number;
}): string {
  const label = params.productName.trim() || "your batch";
  const products = params.products.filter((p) => p.productName.trim().length > 0);
  const checkoutTotal = reconciliationChargeTotalCents(params.checkout);
  const actualTotal = reconciliationChargeTotalCents(params.actual);
  const grossDelta = actualTotal - checkoutTotal;
  const delta = remainingMerchandiseTopupCents({
    grossDeltaCents: grossDelta,
    paidNetCents: params.paidTopupCents ?? 0,
  });
  const allocatedActuals = allocateBatchActualChargesToProducts(
    products,
    params.actual,
  );

  const lines: string[] = [];
  const firstName = customerGreetingFirstName(params.customerName);
  lines.push(
    firstName ?
      `Hi ${firstName} — we're contacting you about ${label}.`
    : `Hi — we're contacting you about ${label}.`,
  );
  lines.push("");
  lines.push(
    "Purchase prices can change for each product in this batch. Details per product:",
  );
  lines.push("");

  const anyLineShares = products.some(
    (p) => reconciliationChargeTotalCents(productCheckoutChargeBreakdown(p)) > 0,
  );

  products.forEach((product, i) => {
    lines.push(...formatReconciliationProductBlock(product, i + 1));
    lines.push("");
    if (anyLineShares) {
      const lineCheckout = productCheckoutChargeBreakdown(product);
      const lineActual = allocatedActuals[i] ?? {
        merchandiseCents: 0,
        shippingCents: 0,
        taxCents: 0,
        serviceCents: 0,
      };
      appendChargeComparison(lines, lineCheckout, lineActual);
      lines.push("");
    }
  });

  if (!anyLineShares) {
    appendChargeComparison(lines, params.checkout, params.actual);
    lines.push("");
  }

  lines.push("Batch totals");
  lines.push(`• Checkout subtotal: ${formatUsd(checkoutTotal)}`);
  lines.push(`• Updated subtotal: ${formatUsd(actualTotal)}`);
  lines.push("");
  appendDeltaClosing(lines, delta, {
    paidTopupCents: params.paidTopupCents,
    checkoutTotalCents: checkoutTotal,
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Dispatches to single or batch message builders. */
export function buildReconciliationCustomerMessage(params: {
  productName: string;
  isBatch: boolean;
  /** Shopper display name for personalized greeting (first name used). */
  customerName?: string | null;
  /** Preferred structured product details for a neat message layout. */
  products?: ReconciliationProductLineInput[];
  /** Legacy preformatted lines (one string per product). */
  productLines?: string[];
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
}): string {
  if (params.isBatch && params.products && params.products.length > 0) {
    return buildBatchReconciliationCustomerMessage({
      productName: params.productName,
      customerName: params.customerName,
      products: params.products,
      checkout: params.checkout,
      actual: params.actual,
    });
  }
  return buildSingleReconciliationCustomerMessage({
    productName: params.productName,
    customerName: params.customerName,
    products: params.products,
    productLines: params.productLines,
    checkout: params.checkout,
    actual: params.actual,
  });
}

/** Customer decision options on price-up reconciliation messages. */
export type MerchandisePriceDecision = "topup" | "cancel";

export const MERCHANDISE_PRICE_DECISION_MARKER = "Customer decision:";

export const merchandisePriceDecisionOptions = [
  {
    value: "topup" as const,
    label: "Pay the difference (top-up) so we can buy this for you",
  },
  {
    value: "cancel" as const,
    label: "Cancel for a refund",
  },
] as const;

export function formatMerchandisePriceDecisionPromptLines(): string[] {
  return [
    "Please check one option:",
    "",
    ...merchandisePriceDecisionOptions.map((o) => `☐ ${o.label}`),
  ];
}

/** Recorded customer choice posted into the support thread. */
export function formatMerchandisePriceDecisionThreadMessage(
  decision: MerchandisePriceDecision,
): string {
  return [
    MERCHANDISE_PRICE_DECISION_MARKER,
    "",
    ...merchandisePriceDecisionOptions.map(
      (o) => `${o.value === decision ? "☑" : "☐"} ${o.label}`,
    ),
  ].join("\n");
}

export function messageBodyHasMerchandisePriceDecision(body: string): boolean {
  return body.includes(MERCHANDISE_PRICE_DECISION_MARKER);
}

/** Latest recorded customer choice from a support message body, if any. */
export function parseMerchandisePriceDecisionFromBody(
  body: string,
): MerchandisePriceDecision | null {
  if (!messageBodyHasMerchandisePriceDecision(body)) return null;
  // Ballot-box / check variants that may appear after copy/paste or font fallback.
  if (/[☑✅✓✔]\s*Pay the difference/u.test(body)) return "topup";
  if (/[☑✅✓✔]\s*Cancel for a refund/u.test(body)) return "cancel";
  return null;
}

/** Staff price-up message that asks the customer to check a decision option. */
export function messageBodyHasMerchandisePriceDecisionPrompt(
  body: string,
): boolean {
  // Never treat a recorded customer decision as a new staff prompt.
  if (messageBodyHasMerchandisePriceDecision(body)) return false;
  return (
    body.includes("Please check one option:") ||
    (body.includes("☐ Pay the difference") &&
      body.includes("☐ Cancel for a refund"))
  );
}

/**
 * Customer choice that answers the latest Informing prompt, if any.
 * A newer unanswered Informing message clears the prior choice.
 */
export function latestMerchandisePriceDecisionFromMessages(
  messages: ReadonlyArray<{ isFromStaff: boolean; body: string }>,
): MerchandisePriceDecision | null {
  let lastPromptIdx = -1;
  let lastDecisionIdx = -1;
  let lastDecision: MerchandisePriceDecision | null = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (
      m.isFromStaff &&
      messageBodyHasMerchandisePriceDecisionPrompt(m.body)
    ) {
      lastPromptIdx = i;
    }
    if (!m.isFromStaff) {
      const decision = parseMerchandisePriceDecisionFromBody(m.body);
      if (decision) {
        lastDecisionIdx = i;
        lastDecision = decision;
      }
    }
  }
  if (!lastDecision) return null;
  // New Informing prompt after their last decision → wait for a new choice.
  if (lastPromptIdx > lastDecisionIdx) return null;
  return lastDecision;
}

/**
 * True when the latest staff informing prompt is still unanswered
 * (or there was never a customer decision after it). A new Informing
 * message re-opens the customer checkboxes.
 */
export function ticketHasUnansweredMerchandisePriceDecisionPrompt(
  messages: ReadonlyArray<{ isFromStaff: boolean; body: string }>,
): boolean {
  let lastPromptIdx = -1;
  let lastDecisionIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (
      m.isFromStaff &&
      messageBodyHasMerchandisePriceDecisionPrompt(m.body)
    ) {
      lastPromptIdx = i;
    }
    if (!m.isFromStaff && messageBodyHasMerchandisePriceDecision(m.body)) {
      lastDecisionIdx = i;
    }
  }
  return lastPromptIdx >= 0 && lastPromptIdx > lastDecisionIdx;
}

export function merchandiseReconciliationAllowsPurchase(
  row: MerchandiseReconciliationView | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!row) {
    return {
      ok: false,
      message:
        "Record actual retailer merchandise, shipping, tax, and complete price reconciliation before approving purchase.",
    };
  }

  if (row.status === "matched") {
    return { ok: true };
  }

  if (row.status === "cancelled") {
    return {
      ok: false,
      message: "This line was cancelled after a retailer price change.",
    };
  }

  const paidNet = merchandiseTopupPaidNetCents(row);
  const remaining = remainingMerchandiseTopupCents({
    grossDeltaCents: row.deltaCents,
    paidNetCents: paidNet,
  });

  if (row.status === "topup_paid" && remaining === 0 && row.deltaCents >= 0) {
    return { ok: true };
  }

  if (row.deltaCents < 0) {
    return {
      ok: false,
      message:
        "Updated charges are lower than checkout — do not buy. Cancel and refund the customer.",
    };
  }

  if (remaining > 0) {
    if (row.status === "topup_pending") {
      return {
        ok: false,
        message: `Customer top-up of ${formatUsd(row.topupAmountCents ?? remaining)} is still unpaid.`,
      };
    }
    return {
      ok: false,
      message:
        paidNet > 0 ?
          `Charges increased again after a paid top-up. Message the customer for an additional ${formatUsd(remaining)}, then request a top-up or cancel and refund.`
        : "Charges increased. Message the customer, then request a top-up or cancel and refund before approving purchase.",
    };
  }

  return {
    ok: false,
    message: "Complete retailer price reconciliation before approving purchase.",
  };
}

export function defaultMerchandisePriceChangeMessage(params: {
  productName: string;
  isBatch?: boolean;
  customerName?: string | null;
  products?: ReconciliationProductLineInput[];
  productLines?: string[];
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents: number;
}): string {
  return buildReconciliationCustomerMessage({
    productName: params.productName,
    isBatch: params.isBatch ?? false,
    customerName: params.customerName,
    products: params.products,
    productLines: params.productLines,
    checkout: {
      merchandiseCents: params.checkoutMerchandiseCents,
      shippingCents: params.checkoutShippingCents,
      taxCents: params.checkoutTaxCents,
      serviceCents: params.checkoutServiceCents,
    },
    actual: {
      merchandiseCents: params.actualMerchandiseCents,
      shippingCents: params.actualShippingCents,
      taxCents: params.actualTaxCents,
      serviceCents: params.actualServiceCents,
    },
  });
}

/** Stable customer-facing top-up reference from the reconciliation id. */
export function formatMerchandiseTopupNumber(reconciliationId: string): string {
  const compact = reconciliationId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TOP-${compact}`;
}

function formatTopupExpiryLabel(expiresAtIso: string): string {
  const expires = new Date(expiresAtIso);
  return Number.isFinite(expires.getTime())
    ? expires.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "soon";
}

/** Where customers complete a purchase-price top-up add-on. */
export function merchandiseTopupAddOnPaymentInstructions(params: {
  topupAmountCents: number;
  expiresAtIso: string;
  productName?: string;
  /** When true, skip “thanks for choosing…” (used with full charge breakdown). */
  afterChargeBreakdown?: boolean;
}): string {
  const label = params.productName?.trim() || "your product";
  const when = formatTopupExpiryLabel(params.expiresAtIso);
  const amount = formatUsd(Math.max(0, params.topupAmountCents));
  const lead =
    params.afterChargeBreakdown ?
      `We've requested a top-up add-on of ${amount} for ${label} so we can buy this for you. ` +
      `Please complete it by ${when}.`
    : `Thanks for choosing to pay the difference so we can buy this for you.\n\n` +
      `We've requested a top-up of ${amount} for ${label} ` +
      `(covers merchandise, shipping, sales tax, and/or service & handling difference). ` +
      `Please complete it by ${when}.`;

  return (
    `${lead}\n\n` +
    `Where to find the new charge:\n` +
    `• Go to Shopping → Add item → Products (Active).\n` +
    `• In the products table, look for the Top-up due row, add it to your Cart, then check out.\n\n` +
    `You can also open Status updates (bell icon) for “Price increased — pay extra charge”.`
  );
}

/**
 * Auto top-up thread body: checkout-vs-actual breakdown (Message customer style)
 * plus add-on payment instructions. Strips the ☐ decision prompt when present.
 */
export function composeMerchandiseAutoTopupMessage(params: {
  chargeDetailMessage: string;
  topupAmountCents: number;
  expiresAtIso: string;
  productName: string;
}): string {
  let detail = params.chargeDetailMessage.trim();
  const decisionIdx = detail.search(/\nPlease check one option:/i);
  if (decisionIdx >= 0) {
    detail = detail.slice(0, decisionIdx).trimEnd();
  } else if (/^Please check one option:/i.test(detail)) {
    detail = "";
  }

  const payment = merchandiseTopupAddOnPaymentInstructions({
    topupAmountCents: params.topupAmountCents,
    expiresAtIso: params.expiresAtIso,
    productName: params.productName,
    afterChargeBreakdown: true,
  });

  if (!detail) return payment;
  return `${detail}\n\n${payment}`;
}

export function defaultMerchandiseTopupMessage(params: {
  productName: string;
  topupAmountCents: number;
  expiresAtIso: string;
}): string {
  return merchandiseTopupAddOnPaymentInstructions({
    topupAmountCents: params.topupAmountCents,
    expiresAtIso: params.expiresAtIso,
    productName: params.productName,
    afterChargeBreakdown: false,
  });
}

/** Thank-you after the customer pays a purchase-price top-up add-on. */
export function defaultMerchandiseTopupPaidMessage(params: {
  topupNumber: string;
  /** This payment only. */
  topupAmountCents: number;
  /** Prior top-up cents already collected (before this payment). */
  priorPaidTopupCents?: number;
  topupCheckoutOrderId: string | null;
  merchandiseOrderId: string;
  batchNumber: string | null;
  productNames: string[];
  checkoutSubtotalCents: number;
  /** checkout + all paid top-ups including this payment. */
  newTotalCents: number;
}): string {
  const products =
    params.productNames.length > 0 ?
      params.productNames.join(" · ")
    : "your products";
  const priorPaid = Math.max(0, params.priorPaidTopupCents ?? 0);
  const thisPaid = Math.max(0, params.topupAmountCents);
  const isAdditional = priorPaid > 0;
  const scopeLine =
    params.batchNumber ?
      `• Batch #: ${params.batchNumber}`
    : isAdditional ?
      `• Single product top-up (additional)`
    : `• Single product top-up`;
  const topupOrderLine =
    params.topupCheckoutOrderId ?
      `• Top-up order #: ${params.topupCheckoutOrderId}\n`
    : "";

  const totalsBlock =
    isAdditional ?
      `Totals:\n` +
      `• Original checkout subtotal: ${formatUsd(params.checkoutSubtotalCents)}\n` +
      `• Previous top-up add-on: ${formatUsd(priorPaid)}\n` +
      `• This top-up add-on: ${formatUsd(thisPaid)}\n` +
      `• New total: ${formatUsd(params.newTotalCents)}\n\n`
    : `Totals:\n` +
      `• Original checkout subtotal: ${formatUsd(params.checkoutSubtotalCents)}\n` +
      `• Top-up add-on: ${formatUsd(thisPaid)}\n` +
      `• New total: ${formatUsd(params.newTotalCents)}\n\n`;

  return (
    (isAdditional ?
      `Thank you — we've received your additional purchase-price top-up payment.\n\n`
    : `Thank you — we've received your purchase-price top-up payment.\n\n`) +
    `Top-up details:\n` +
    `• Top-up #: ${params.topupNumber}\n` +
    `• Amount paid: ${formatUsd(thisPaid)}\n` +
    topupOrderLine +
    `\n` +
    `Applied to:\n` +
    `• Merchandise order #: ${params.merchandiseOrderId}\n` +
    `${scopeLine}\n` +
    `• Products: ${products}\n\n` +
    totalsBlock +
    `We'll begin purchasing your products shortly. No further action is needed from you on this top-up.`
  );
}

/** Staff auto-message when an additional top-up is due after one was already paid. */
export function defaultMerchandiseAdditionalTopupMessage(params: {
  productName: string;
  topupNumber: string;
  additionalTopupCents: number;
  priorPaidTopupCents: number;
  checkoutSubtotalCents: number;
  merchandiseOrderId: string;
  expiresAtIso: string;
  batchNumber?: string | null;
}): string {
  const label = params.productName.trim() || "your product";
  const priorPaid = Math.max(0, params.priorPaidTopupCents);
  const additional = Math.max(0, params.additionalTopupCents);
  const checkout = Math.max(0, params.checkoutSubtotalCents);
  const totalSoFar = checkout + priorPaid;
  const updatedTotal = totalSoFar + additional;
  const expires = new Date(params.expiresAtIso);
  const when = Number.isFinite(expires.getTime())
    ? expires.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "soon";
  const scopeLine =
    params.batchNumber ?
      `• Batch #: ${params.batchNumber}`
    : `• Single product top-up (additional)`;

  return (
    `Purchase prices were updated again for ${label}, so an additional top-up is needed.\n\n` +
    `Top-up details:\n` +
    `• Top-up #: ${params.topupNumber}\n` +
    `• Additional amount due: ${formatUsd(additional)}\n` +
    `• Please complete it by ${when}.\n\n` +
    `Applied to:\n` +
    `• Merchandise order #: ${params.merchandiseOrderId}\n` +
    `${scopeLine}\n` +
    `• Products: ${label}\n\n` +
    `Totals:\n` +
    `• Original checkout subtotal: ${formatUsd(checkout)}\n` +
    `• Top-up already paid: ${formatUsd(priorPaid)}\n` +
    `• New total so far: ${formatUsd(totalSoFar)}\n` +
    `• Additional top-up add-on: ${formatUsd(additional)}\n` +
    `• Updated total after this top-up: ${formatUsd(updatedTotal)}\n\n` +
    `Where to find the new charge:\n` +
    `• Go to Shopping → Add item → Products (Active).\n` +
    `• In the products table, look for the Top-up due row, add it to your Cart, then check out.\n\n` +
    `You can also open Status updates (bell icon) for “Price increased — pay extra charge”.`
  );
}

export function defaultMerchandiseCancelRefundMessage(params: {
  productName: string;
  refundCents: number;
}): string {
  const label = params.productName.trim() || "your product";
  return (
    `We cancelled ${label} because of a purchase price change and issued a refund of ` +
    `${formatUsd(params.refundCents)}. ` +
    `Refunds usually post to your original payment method within 5–10 business days after Stripe processes them.`
  );
}

/** Staff draft after revoking an unpaid purchase-price top-up add-on. */
export function defaultMerchandiseTopupRevokedMessage(params: {
  productName: string;
  topupNumber: string;
  topupAmountCents: number;
  isBatch?: boolean;
}): string {
  const label = params.productName.trim() || "your product";
  const amount = formatUsd(Math.max(0, params.topupAmountCents));
  const scope =
    params.isBatch ? "batch order" : "product";
  return (
    `We've revoked the purchase-price top-up add-on of ${amount} for your ${scope} (${label}).\n\n` +
    `Top-up details:\n` +
    `• Top-up #: ${params.topupNumber}\n` +
    `• Amount revoked: ${amount}\n\n` +
    `You no longer need to pay this add-on charge. It has been removed from Shopping → Add item → Products (Active).\n\n` +
    `If you have questions or need more feedback, please reply here or contact Amani Cart2Barrel Support.`
  );
}
