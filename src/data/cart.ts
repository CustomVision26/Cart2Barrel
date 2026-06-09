import { and, desc, eq, inArray, isNull, notExists } from "drizzle-orm";

import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessionLines,
  batchQuoteSessions,
  itemQuotes,
  itemRequestLineSnapshots,
  itemRequests,
  orderContainerItems,
  orderItems,
  orders,
  type BatchQuoteEstimate,
  type ItemQuote,
  type ItemRequest,
  type Order,
} from "@/db/schema";
import {
  itemRequestFromRowWithoutReceiptImage,
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  itemRequestsRowSelectWithoutReceiptImage,
  withLegacyItemRequestDefaults,
} from "@/data/item-requests";
import { itemQuoteCoreSelect, itemQuoteCoreSelectPreMerchandiseSavings } from "@/data/item-quotes";
import { listOutsidePurchaseReturnRequestsByItemRequestIds } from "@/data/outside-purchase-return-requests";
import { orderListSelect } from "@/data/order-list-select";
import { outsidePurchaseReturnTransitCheckoutCaption } from "@/lib/outside-purchase-display";
import type { ContainerCheckoutLine } from "@/data/user-container-cart";
import { allocateBundleSubtotalAcrossLineTotalsCents } from "@/lib/batch-cart-allocation";
import type {
  ContainerPackingFeeBreakdown,
  ContainerPackingRates,
} from "@/lib/container-packing-fee";
import {
  allocateContainerPackingFeeToLineCents,
  containerPackingPerUnitCentsForKind,
  containerPackingPerUnitCentsFromBreakdown,
} from "@/lib/container-packing-fee";
import {
  containerOfferingKindLabel,
  parseContainerOfferingKind,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { resolveContainerPackingForUserCart } from "@/data/user-cart-container-packing";
import { formatUsd } from "@/lib/admin-markup";
import { displaySiteName } from "@/lib/site-name";
import { buildCheckoutProductDetailText } from "@/lib/checkout-product-reference";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import {
  isMissingBatchQuoteSessionIdColumnError,
  isMissingOutsidePurchaseReceiptImageUrlColumnError,
  isMissingMerchandiseSavingsColumnError,
  isUndefinedColumnError,
} from "@/lib/db-column-missing";

export type CartLine = {
  request: ItemRequest;
  quote: ItemQuote;
  taxCents: number;
  /** Best HTTPS thumbnail URL for the cart row (live request field or latest audit snapshot). */
  displayProductImageUrl: string | null;
};

function notInAnyOrderClause() {
  const db = getDb();
  return notExists(
    db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.itemRequestId, itemRequests.id))
  );
}

async function fetchQuotesForCartItemRequests(
  itemRequestIds: string[]
): Promise<ItemQuote[]> {
  if (itemRequestIds.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemQuotes)
      .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
  } catch (e) {
    if (isMissingMerchandiseSavingsColumnError(e)) {
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
      return rows.map((r) => ({
        ...r,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        staffNote: null,
        checkoutSnapshotKind: null,
        recordedByClerkUserId: null,
      }));
    }
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    try {
      const rows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
      return rows.map((r) => ({
        ...r,
        checkoutSnapshotKind: null,
        recordedByClerkUserId: null,
      }));
    } catch (e2) {
      if (!isMissingMerchandiseSavingsColumnError(e2)) {
        throw e2;
      }
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
      return rows.map((r) => ({
        ...r,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        staffNote: null,
        checkoutSnapshotKind: null,
        recordedByClerkUserId: null,
      }));
    }
  }
}

export async function countApprovedCartItemsForUser(
  clerkUserId: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: itemRequests.id })
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "approved"),
        notInAnyOrderClause()
      )
    );
  return rows.length;
}

/**
 * Approved item requests with their latest quote (cart-ready lines).
 */
export async function listApprovedCartLinesForUser(
  clerkUserId: string
): Promise<CartLine[]> {
  const db = getDb();
  let requests: ItemRequest[];
  try {
    requests = await db
      .select()
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          eq(itemRequests.status, "approved"),
          notInAnyOrderClause()
        )
      )
      .orderBy(desc(itemRequests.createdAt));
  } catch (e) {
    if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      const rows = await db
        .select(itemRequestsRowSelectWithoutReceiptImage)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            eq(itemRequests.status, "approved"),
            notInAnyOrderClause()
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      requests = rows.map(itemRequestFromRowWithoutReceiptImage);
    } else if (isMissingBatchQuoteSessionIdColumnError(e)) {
      try {
        const rows = await db
          .select(itemRequestsRowLegacySelect)
          .from(itemRequests)
          .where(
            and(
              eq(itemRequests.clerkUserId, clerkUserId),
              eq(itemRequests.status, "approved"),
              notInAnyOrderClause()
            )
          )
          .orderBy(desc(itemRequests.createdAt));
        requests = rows.map(withLegacyItemRequestDefaults);
      } catch (legacyErr) {
        if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(legacyErr)) {
          throw legacyErr;
        }
        const rows = await db
          .select(itemRequestsRowLegacySelectWithoutReceiptImage)
          .from(itemRequests)
          .where(
            and(
              eq(itemRequests.clerkUserId, clerkUserId),
              eq(itemRequests.status, "approved"),
              notInAnyOrderClause()
            )
          )
          .orderBy(desc(itemRequests.createdAt));
        requests = rows.map(withLegacyItemRequestDefaults);
      }
    } else {
      throw e;
    }
  }

  if (requests.length === 0) {
    return [];
  }

  const ids = requests.map((r) => r.id);
  const quotes = await fetchQuotesForCartItemRequests(ids);

  const snapshotRows =
    ids.length === 0
      ? []
      : await db
          .select({
            itemRequestId: itemRequestLineSnapshots.itemRequestId,
            productImageUrl: itemRequestLineSnapshots.productImageUrl,
          })
          .from(itemRequestLineSnapshots)
          .where(inArray(itemRequestLineSnapshots.itemRequestId, ids))
          .orderBy(desc(itemRequestLineSnapshots.createdAt));

  const newestSnapshotImageByRequestId = new Map<string, string>();
  for (const row of snapshotRows) {
    const url = row.productImageUrl?.trim();
    if (!url || newestSnapshotImageByRequestId.has(row.itemRequestId)) continue;
    newestSnapshotImageByRequestId.set(row.itemRequestId, url);
  }

  const latestByRequest = new Map<string, ItemQuote>();
  for (const q of quotes) {
    if (q.voidedAt != null) continue;
    if (!isOperationalQuoteRow(q)) continue;
    const prev = latestByRequest.get(q.itemRequestId);
    if (
      !prev ||
      new Date(q.createdAt).getTime() > new Date(prev.createdAt).getTime()
    ) {
      latestByRequest.set(q.itemRequestId, q);
    }
  }

  const lines: CartLine[] = [];
  for (const request of requests) {
    const quote = latestByRequest.get(request.id);
    if (!quote) continue;
    const taxCents = Math.max(
      0,
      quote.totalPrice -
        quote.itemCost -
        quote.serviceFee -
        quote.estimatedShipping
    );
    const fromRequest = request.productImageUrl?.trim() || null;
    const displayProductImageUrl =
      fromRequest ?? newestSnapshotImageByRequestId.get(request.id) ?? null;
    lines.push({ request, quote, taxCents, displayProductImageUrl });
  }

  return lines;
}

export type CartBatchGroup = {
  sessionId: string;
  batchNumber: string;
  siteKey: string;
  estimate: BatchQuoteEstimate;
  lines: CartLine[];
};

export type AssembledCart = {
  batchGroups: CartBatchGroup[];
  standaloneLines: CartLine[];
  estimatedTotalCents: number;
};

export type CheckoutOrderLineInput = {
  itemRequestId: string;
  quantity: number;
  priceCents: number;
};

/**
 * Groups approved cart lines into accepted batch bundles (combined staff subtotal) vs
 * standalone accepted quotes.
 */
export async function assembleApprovedCartForUser(
  clerkUserId: string
): Promise<AssembledCart> {
  const lines = await listApprovedCartLinesForUser(clerkUserId);
  if (lines.length === 0) {
    return { batchGroups: [], standaloneLines: [], estimatedTotalCents: 0 };
  }

  const db = getDb();
  const requestIds = lines.map((l) => l.request.id);

  const links =
    requestIds.length === 0
      ? []
      : await db
          .select({
            itemRequestId: batchQuoteSessionLines.itemRequestId,
            batchSessionId: batchQuoteSessionLines.batchQuoteSessionId,
          })
          .from(batchQuoteSessionLines)
          .where(inArray(batchQuoteSessionLines.itemRequestId, requestIds));

  const linkedSessionIds = [...new Set(links.map((l) => l.batchSessionId))];
  const sessions =
    linkedSessionIds.length === 0
      ? []
      : await db
          .select()
          .from(batchQuoteSessions)
          .where(
            and(
              eq(batchQuoteSessions.clerkUserId, clerkUserId),
              inArray(batchQuoteSessions.id, linkedSessionIds)
            )
          );

  const lineByRequestId = new Map(lines.map((l) => [l.request.id, l]));

  const acceptedSessions = sessions.filter(
    (s) => s.status === "in_cart" || Boolean(s.cartAcceptanceAcceptedAt),
  );

  const initialEstimateIds = [
    ...new Set(
      acceptedSessions
        .map((s) => s.cartAcceptanceAcceptedEstimateId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const initialEstimateRows =
    initialEstimateIds.length === 0
      ? []
      : await db
          .select()
          .from(batchQuoteEstimates)
          .where(inArray(batchQuoteEstimates.id, initialEstimateIds));
  const estimateById = new Map(initialEstimateRows.map((e) => [e.id, e]));

  const sessionIdsNeedingFallback = acceptedSessions
    .filter((s) => {
      const id = s.cartAcceptanceAcceptedEstimateId;
      if (!id) return true;
      const row = estimateById.get(id);
      return !row || row.voidedAt != null || row.batchQuoteSessionId !== s.id;
    })
    .map((s) => s.id);

  const latestEstimateBySessionId = new Map<string, BatchQuoteEstimate>();
  for (const sid of sessionIdsNeedingFallback) {
    const [row] = await db
      .select()
      .from(batchQuoteEstimates)
      .where(
        and(
          eq(batchQuoteEstimates.batchQuoteSessionId, sid),
          isNull(batchQuoteEstimates.voidedAt),
        ),
      )
      .orderBy(desc(batchQuoteEstimates.createdAt))
      .limit(1);
    if (row) {
      latestEstimateBySessionId.set(sid, row);
      estimateById.set(row.id, row);
    }
  }

  const batchGroups: CartBatchGroup[] = [];
  for (const session of acceptedSessions) {
    let estimate: BatchQuoteEstimate | undefined;
    const preferredId = session.cartAcceptanceAcceptedEstimateId;
    if (preferredId) {
      const row = estimateById.get(preferredId);
      if (
        row &&
        row.voidedAt == null &&
        row.batchQuoteSessionId === session.id
      ) {
        estimate = row;
      }
    }
    if (!estimate) {
      estimate = latestEstimateBySessionId.get(session.id);
    }
    if (!estimate) continue;

    const requestIdsInBatch = links
      .filter(
        (ln) =>
          ln.batchSessionId === session.id && lineByRequestId.has(ln.itemRequestId),
      )
      .map((ln) => ln.itemRequestId);

    const batchLines = requestIdsInBatch
      .map((id) => lineByRequestId.get(id))
      .filter((l): l is CartLine => Boolean(l));

    if (batchLines.length === 0) continue;

    batchGroups.push({
      sessionId: session.id,
      batchNumber: session.batchNumber,
      siteKey: session.siteKey,
      estimate,
      lines: batchLines,
    });
  }

  const inAcceptedBatch = new Set<string>();
  for (const g of batchGroups) {
    for (const l of g.lines) {
      inAcceptedBatch.add(l.request.id);
    }
  }

  const standaloneLines = lines.filter((l) => !inAcceptedBatch.has(l.request.id));

  const batchTotal = batchGroups.reduce((s, g) => s + g.estimate.subtotalCents, 0);
  const standaloneTotal = standaloneLines.reduce(
    (s, l) => s + l.quote.totalPrice,
    0
  );

  return {
    batchGroups,
    standaloneLines,
    estimatedTotalCents: batchTotal + standaloneTotal,
  };
}

export function buildCheckoutOrderLinesFromAssembledCart(
  assembled: AssembledCart
): CheckoutOrderLineInput[] {
  const out: CheckoutOrderLineInput[] = [];

  for (const group of assembled.batchGroups) {
    const weights = group.lines.map((l) => l.quote.totalPrice);
    const allocated = allocateBundleSubtotalAcrossLineTotalsCents(
      weights,
      group.estimate.subtotalCents
    );
    group.lines.forEach((line, i) => {
      out.push({
        itemRequestId: line.request.id,
        quantity: line.request.quantity,
        priceCents: allocated[i] ?? 0,
      });
    });
  }

  for (const line of assembled.standaloneLines) {
    out.push({
      itemRequestId: line.request.id,
      quantity: line.request.quantity,
      priceCents: line.quote.totalPrice,
    });
  }

  return out;
}

/** Single Checkout `price_data` line (quantity is always `1`). */
export type StripeCheckoutPriceDataLine = {
  quantity: 1;
  price_data: {
    currency: "usd";
    unit_amount: number;
    product_data: { name: string; description?: string };
  };
};

/** USD card Checkout requires at least $0.50 per line_item (Stripe). */
export const STRIPE_CHECKOUT_LINE_MIN_US_CENTS = 50;

/**
 * Batch tax CHARGED in the bundled subtotal comes from **`site_sale_tax_total_cents`**
 * (staff site roll-up baked into {@link BatchQuoteEstimate.subtotalCents}).
 *
 * Do **not** add {@link BatchQuoteEstimate.batchSaleTaxTotalCents} here: it is the pre-adjustment sum
 * of per-line quoted taxes (“batch sale tax” in UI). `sale_tax_discount_cents` reconciles batch → site;
 * including batch + discount would double-count (e.g. site = batch = $1.33 ⇒ Stripe showed $2.66).
 */
function batchQuotedSaleTaxInsideSubtotal(
  estimate: BatchQuoteEstimate,
): number {
  const siteSaleTax = estimate.siteSaleTaxTotalCents;
  if (!Number.isFinite(siteSaleTax) || siteSaleTax <= 0) return 0;
  return Math.min(siteSaleTax, Math.max(0, estimate.subtotalCents));
}

function splitGoodsAndQuotedTaxForBatch(
  estimate: BatchQuoteEstimate,
): { goodsCentsForStripe: number; quotedTaxCents: number } {
  const tax = batchQuotedSaleTaxInsideSubtotal(estimate);
  const goods = estimate.subtotalCents - tax;
  if (
    goods < STRIPE_CHECKOUT_LINE_MIN_US_CENTS &&
    estimate.subtotalCents >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS
  ) {
    /** Would violate Stripe minimum on the merchandise row; keep tax embedded. */
    return {
      goodsCentsForStripe: estimate.subtotalCents,
      quotedTaxCents: 0,
    };
  }
  return {
    goodsCentsForStripe: goods,
    quotedTaxCents: tax,
  };
}

function splitGoodsAndQuotedTaxForStandalone(line: CartLine): {
  goodsCentsForStripe: number;
  quotedTaxCents: number;
} {
  const tax = Math.min(
    Math.max(0, line.taxCents),
    Math.max(0, line.quote.totalPrice),
  );
  const goods = line.quote.totalPrice - tax;
  if (
    goods < STRIPE_CHECKOUT_LINE_MIN_US_CENTS &&
    line.quote.totalPrice >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS
  ) {
    return {
      goodsCentsForStripe: line.quote.totalPrice,
      quotedTaxCents: 0,
    };
  }
  return { goodsCentsForStripe: goods, quotedTaxCents: tax };
}

function bumpLargestCheckoutLine(items: StripeCheckoutPriceDataLine[], add: number) {
  if (add <= 0 || items.length === 0) return;
  let bestIdx = 0;
  let bestAmt = items[0].price_data.unit_amount;
  for (let i = 1; i < items.length; i++) {
    const a = items[i].price_data.unit_amount;
    if (a > bestAmt) {
      bestAmt = a;
      bestIdx = i;
    }
  }
  items[bestIdx].price_data.unit_amount += add;
}

/** Rolls sub-minimum Stripe allocations into the largest line (USD $0.50 floor). */
function mergeSubMinimumStripeAllocations(amounts: number[]): number[] {
  const min = STRIPE_CHECKOUT_LINE_MIN_US_CENTS;
  const out = [...amounts];
  let carry = 0;
  let largestIdx = -1;
  let largestAmt = 0;

  for (let i = 0; i < out.length; i++) {
    const amt = out[i];
    if (amt <= 0) continue;
    if (amt < min) {
      carry += amt;
      out[i] = 0;
      continue;
    }
    if (amt > largestAmt) {
      largestAmt = amt;
      largestIdx = i;
    }
  }

  if (carry > 0 && largestIdx >= 0) {
    out[largestIdx] += carry;
  }

  return out;
}

function batchProductStripeDescription(
  group: CartBatchGroup,
  line: CartLine,
  opts: {
    taxExcludedFromGoodsLine: boolean;
    orderItemIdByRequestId?: Map<string, string>;
  },
): string {
  const site = displaySiteName(line.request.siteName, line.request.productUrl);
  const parts: string[] = [];
  const referenceDetail = buildCheckoutProductDetailText({
    batchNumber: group.batchNumber,
    orderItemId: opts.orderItemIdByRequestId?.get(line.request.id),
    itemRequestId: line.request.id,
    outsidePurchaseReference: line.request.outsidePurchaseReference,
    productUrl: line.request.productUrl,
    source: line.request.source,
    quantity: line.request.quantity,
    siteName: site || group.siteKey,
  });
  if (referenceDetail) {
    parts.push(referenceDetail);
  } else {
    parts.push(`Batch ${group.batchNumber}`, `Qty ${line.request.quantity}`);
  }
  const size = line.request.productSize?.trim();
  const color = line.request.productColor?.trim();
  if (size) parts.push(`Size ${size}`);
  if (color) parts.push(`Color ${color}`);
  if (opts.taxExcludedFromGoodsLine) {
    parts.push("merchandise & fees excluding estimated sale tax");
  }
  return parts.join(" · ");
}

function buildStripeLinesForBatchGroup(
  group: CartBatchGroup,
  goodsCentsForStripe: number,
  quotedTaxCents: number,
  orderItemIdByRequestId?: Map<string, string>,
): StripeCheckoutPriceDataLine[] {
  const weights = group.lines.map((l) => l.quote.totalPrice);
  const allocated = mergeSubMinimumStripeAllocations(
    allocateBundleSubtotalAcrossLineTotalsCents(weights, goodsCentsForStripe),
  );

  const nonZeroCount = allocated.filter((c) => c > 0).length;
  const allMeetMinimum =
    nonZeroCount === group.lines.length &&
    allocated.every(
      (c) => c === 0 || c >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS,
    );

  if (!allMeetMinimum || nonZeroCount === 0) {
    const n = group.lines.length;
    return [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: goodsCentsForStripe,
          product_data: {
            name: `Batch ${group.batchNumber}`,
            description:
              quotedTaxCents > 0 ?
                `${n} item${n === 1 ? "" : "s"} · ${group.siteKey} · merchandise & fees excluding estimated sale tax`
              : `${n} item${n === 1 ? "" : "s"} · ${group.siteKey}`,
          },
        },
      },
    ];
  }

  const taxExcluded = quotedTaxCents > 0;
  const productLines: StripeCheckoutPriceDataLine[] = [];

  group.lines.forEach((line, i) => {
    const unitAmount = allocated[i] ?? 0;
    if (unitAmount <= 0) return;

    const name = line.request.productName?.trim() || "Requested item";
    productLines.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: unitAmount,
        product_data: {
          name,
          description: batchProductStripeDescription(group, line, {
            taxExcludedFromGoodsLine: taxExcluded,
            orderItemIdByRequestId,
          }),
        },
      },
    });
  });

  return productLines;
}

/**
 * Builds Stripe Checkout `line_items` from cart merchandise. Quoted retailer/site sale tax is
 * split into a dedicated line when Stripe’s USD minimum-per-line rules allow so it appears as
 * “tax” on receipts and Dashboard; totals match the bundled staff estimates.
 */
export function buildStripeLineItemsFromAssembledCart(
  assembled: AssembledCart,
  orderItemIdByRequestId?: Map<string, string>,
): {
  lineItems: StripeCheckoutPriceDataLine[];
  /** Sum of tax taken from estimates (intent), even when folded back for Stripe minimums. */
  quotedSalesTaxIntentCents: number;
} {
  const items: StripeCheckoutPriceDataLine[] = [];
  let quotedTaxStripePool = 0;
  let quotedSalesTaxIntentCents = 0;

  for (const group of assembled.batchGroups) {
    quotedSalesTaxIntentCents += batchQuotedSaleTaxInsideSubtotal(
      group.estimate,
    );

    const { goodsCentsForStripe, quotedTaxCents } = splitGoodsAndQuotedTaxForBatch(
      group.estimate,
    );
    quotedTaxStripePool += quotedTaxCents;

    items.push(
      ...buildStripeLinesForBatchGroup(
        group,
        goodsCentsForStripe,
        quotedTaxCents,
        orderItemIdByRequestId,
      ),
    );
  }

  for (const line of assembled.standaloneLines) {
    quotedSalesTaxIntentCents += Math.min(
      Math.max(0, line.taxCents),
      Math.max(0, line.quote.totalPrice),
    );

    const name = line.request.productName?.trim() || "Requested item";
    const { goodsCentsForStripe, quotedTaxCents } =
      splitGoodsAndQuotedTaxForStandalone(line);
    quotedTaxStripePool += quotedTaxCents;
    const referenceDetail = buildCheckoutProductDetailText({
      orderItemId: orderItemIdByRequestId?.get(line.request.id),
      itemRequestId: line.request.id,
      outsidePurchaseReference: line.request.outsidePurchaseReference,
      productUrl: line.request.productUrl,
      source: line.request.source,
      quantity: line.request.quantity,
      siteName: displaySiteName(line.request.siteName, line.request.productUrl),
    });
    const descriptionParts = [
      referenceDetail,
      quotedTaxCents > 0 ? "merchandise & fees excluding estimated sale tax" : null,
    ].filter((part): part is string => Boolean(part));
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: goodsCentsForStripe,
        product_data: {
          name,
          description:
            descriptionParts.length > 0 ?
              descriptionParts.join(" · ")
            : `Qty ${line.request.quantity}`,
        },
      },
    });
  }

  if (quotedTaxStripePool >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: quotedTaxStripePool,
        product_data: {
          name: "Estimated sales tax",
          description:
            "Retailer/site sale taxes from quoted staff estimates (combined checkout line)",
        },
      },
    });
  } else if (quotedTaxStripePool > 0) {
    bumpLargestCheckoutLine(items, quotedTaxStripePool);
  }

  return { lineItems: items, quotedSalesTaxIntentCents };
}

/** Stripe line items for barrel/bin packing fees (one line per kind when non-zero). */
export function buildStripeLineItemsFromContainerPackingBreakdown(
  breakdown: ContainerPackingFeeBreakdown,
): StripeCheckoutPriceDataLine[] {
  const items: StripeCheckoutPriceDataLine[] = [];
  if (breakdown.barrelPackingFeeCents > 0) {
    const n = breakdown.barrelCount;
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: breakdown.barrelPackingFeeCents,
        product_data: {
          name: "Barrel packing fee",
          description:
            n === 1 ?
              "Single-barrel packing rate"
            : `${n} barrels at multi-barrel per-unit rate`,
        },
      },
    });
  }
  if (breakdown.binPackingFeeCents > 0) {
    const n = breakdown.binCount;
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: breakdown.binPackingFeeCents,
        product_data: {
          name: "Bin packing fee",
          description:
            n === 1 ? "Single-bin packing rate" : `${n} bins at multi-bin per-unit rate`,
        },
      },
    });
  }
  return items;
}

export function buildStripeLineItemsFromContainerCheckoutLines(
  lines: ContainerCheckoutLine[],
  packing?: {
    barrelCount: number;
    binCount: number;
    rates: ContainerPackingRates;
  },
): StripeCheckoutPriceDataLine[] {
  return lines.map((line) => {
    const containerSubtotalCents = line.lineTotalCents;
    const packagingFeeCents =
      packing ?
        allocateContainerPackingFeeToLineCents({
          kind: line.kind,
          quantity: line.quantity,
          barrelCount: packing.barrelCount,
          binCount: packing.binCount,
          rates: packing.rates,
        })
      : 0;
    const packagingPerUnitCents =
      packing ?
        containerPackingPerUnitCentsForKind(
          line.kind,
          packing.barrelCount,
          packing.binCount,
          packing.rates,
        )
      : 0;
    const chargeCents = containerSubtotalCents + packagingFeeCents;
    const kindLabel = containerOfferingKindLabel(line.kind);
    const packagingDetail =
      packagingFeeCents > 0 ?
        ` · Packaging ${line.quantity} × ${formatUsd(packagingPerUnitCents)}`
      : "";

    return {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: chargeCents,
        product_data: {
          name: line.name,
          description: `${kindLabel} · ${line.sizeLabel} · Container ${formatUsd(containerSubtotalCents)}${packagingDetail}`,
        },
      },
    };
  });
}

export type CartCheckoutSummaryLine = {
  itemRequestId: string;
  orderItemId: string;
  productName: string | null;
  productUrl: string;
  source: ItemRequest["source"];
  outsidePurchaseReference: string | null;
  quantity: number;
  lineTotalCents: number;
  outsidePurchaseReceiptImageUrl: string | null;
  /** Explains return-transit fees on checkout (outside-purchase return workflow). */
  chargeCaption: string | null;
  /** Batch number when this line is part of a consolidated bundle. */
  batchNumber: string | null;
  /** Product # / OP # / batch metadata for display. */
  productReferenceDetail: string | null;
};

export type CartCheckoutBatchBundleSummary = {
  batchSessionId: string;
  batchNumber: string;
  siteKey: string;
  /** Sum of allocated `order_items.price` rows in this bundle (matches Stripe batch line). */
  bundleTotalCents: number;
  lines: CartCheckoutSummaryLine[];
};

export type CartCheckoutContainerSummaryLine = {
  id: string;
  nameSnapshot: string;
  sizeSnapshot: string;
  kind: ContainerOfferingKind;
  quantity: number;
  unitPriceCents: number;
  containerSubtotalCents: number;
  packagingPerUnitCents: number;
  packagingFeeCents: number;
  /** Container + packaging (matches Stripe line when checkout used merged lines). */
  lineTotalCents: number;
};

export type CartCheckoutOrderSummary = {
  orderId: string;
  status: Order["status"];
  totalAmount: number;
  batchBundles: CartCheckoutBatchBundleSummary[];
  standaloneLines: CartCheckoutSummaryLine[];
  containerLines: CartCheckoutContainerSummaryLine[];
};

/**
 * Pending / open checkout order lines for the embedded checkout summary UI.
 */
export async function getCartCheckoutOrderSummaryForUser(
  clerkUserId: string,
  orderId: string,
): Promise<CartCheckoutOrderSummary | null> {
  const db = getDb();
  const [order] = await db
    .select(orderListSelect)
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.clerkUserId, clerkUserId)))
    .limit(1);

  if (!order) return null;

  const checkoutLineSelect = {
    orderItemId: orderItems.id,
    itemRequestId: orderItems.itemRequestId,
    quantity: orderItems.quantity,
    price: orderItems.price,
    productName: itemRequests.productName,
    productUrl: itemRequests.productUrl,
    siteName: itemRequests.siteName,
    source: itemRequests.source,
    outsidePurchaseReference: itemRequests.outsidePurchaseReference,
    outsidePurchaseReceiptImageUrl: itemRequests.outsidePurchaseReceiptImageUrl,
    linkBatchSessionId: batchQuoteSessionLines.batchQuoteSessionId,
    requestBatchSessionId: itemRequests.batchQuoteSessionId,
  } as const;

  const checkoutLineSelectWithoutReceipt = {
    orderItemId: orderItems.id,
    itemRequestId: orderItems.itemRequestId,
    quantity: orderItems.quantity,
    price: orderItems.price,
    productName: itemRequests.productName,
    productUrl: itemRequests.productUrl,
    siteName: itemRequests.siteName,
    source: itemRequests.source,
    outsidePurchaseReference: itemRequests.outsidePurchaseReference,
    linkBatchSessionId: batchQuoteSessionLines.batchQuoteSessionId,
    requestBatchSessionId: itemRequests.batchQuoteSessionId,
  } as const;

  type CheckoutLineRow = {
    orderItemId: string;
    itemRequestId: string;
    quantity: number;
    price: number;
    productName: string | null;
    productUrl: string;
    siteName: string | null;
    source: ItemRequest["source"];
    outsidePurchaseReference: string | null;
    outsidePurchaseReceiptImageUrl?: string | null;
    linkBatchSessionId: string | null;
    requestBatchSessionId: string | null;
  };

  let rows: CheckoutLineRow[];
  try {
    rows = await db
      .select(checkoutLineSelect)
      .from(orderItems)
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .leftJoin(
        batchQuoteSessionLines,
        eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
      )
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(itemRequests.clerkUserId, clerkUserId),
        ),
      );
  } catch (e) {
    if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      throw e;
    }
    const legacyRows = await db
      .select(checkoutLineSelectWithoutReceipt)
      .from(orderItems)
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .leftJoin(
        batchQuoteSessionLines,
        eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
      )
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(itemRequests.clerkUserId, clerkUserId),
        ),
      );
    rows = legacyRows.map((r) => ({
      ...r,
      outsidePurchaseReceiptImageUrl: null,
      outsidePurchaseReference: r.outsidePurchaseReference ?? null,
    }));
  }

  const returnRequestsByItemRequestId = new Map(
    (
      await listOutsidePurchaseReturnRequestsByItemRequestIds(
        rows.map((row) => row.itemRequestId),
      )
    ).map((row) => [row.itemRequestId, row]),
  );

  function toLine(
    r: CheckoutLineRow,
    batchNumber: string | null,
  ): CartCheckoutSummaryLine {
    return {
      itemRequestId: r.itemRequestId,
      orderItemId: r.orderItemId,
      productName: r.productName,
      productUrl: r.productUrl,
      source: r.source,
      outsidePurchaseReference: r.outsidePurchaseReference,
      quantity: r.quantity,
      lineTotalCents: r.price,
      outsidePurchaseReceiptImageUrl: r.outsidePurchaseReceiptImageUrl ?? null,
      chargeCaption: outsidePurchaseReturnTransitCheckoutCaption(
        r.source,
        returnRequestsByItemRequestId.get(r.itemRequestId),
      ),
      batchNumber,
      productReferenceDetail: buildCheckoutProductDetailText({
        batchNumber,
        orderItemId: r.orderItemId,
        itemRequestId: r.itemRequestId,
        outsidePurchaseReference: r.outsidePurchaseReference,
        productUrl: r.productUrl,
        source: r.source,
        quantity: r.quantity,
        siteName: batchNumber ? null : r.siteName,
      }),
    };
  }

  const bundleInsertionOrder: string[] = [];
  const linesByBatchId = new Map<string, CartCheckoutSummaryLine[]>();
  const standaloneLines: CartCheckoutSummaryLine[] = [];

  for (const r of rows) {
    const batchId =
      r.linkBatchSessionId ?? r.requestBatchSessionId ?? null;
    if (!batchId) {
      standaloneLines.push(toLine(r, null));
      continue;
    }
    if (!linesByBatchId.has(batchId)) {
      bundleInsertionOrder.push(batchId);
      linesByBatchId.set(batchId, []);
    }
    linesByBatchId.get(batchId)!.push(toLine(r, null));
  }

  const batchSessionIds = bundleInsertionOrder;
  const metaRows =
    batchSessionIds.length === 0
      ? []
      : await db
          .select({
            id: batchQuoteSessions.id,
            batchNumber: batchQuoteSessions.batchNumber,
            siteKey: batchQuoteSessions.siteKey,
          })
          .from(batchQuoteSessions)
          .where(
            and(
              inArray(batchQuoteSessions.id, batchSessionIds),
              eq(batchQuoteSessions.clerkUserId, clerkUserId),
            ),
          );
  const metaById = new Map(metaRows.map((m) => [m.id, m]));

  const batchBundles: CartCheckoutBatchBundleSummary[] = bundleInsertionOrder.map(
    (id) => {
      const lines = linesByBatchId.get(id)!;
      const meta = metaById.get(id);
      const batchNumber = meta?.batchNumber?.trim() || id.slice(0, 8);
      return {
        batchSessionId: id,
        batchNumber,
        siteKey: meta?.siteKey?.trim() || "—",
        bundleTotalCents: lines.reduce((s, l) => s + l.lineTotalCents, 0),
        lines: lines.map((line) => ({
          ...line,
          batchNumber,
          productReferenceDetail: buildCheckoutProductDetailText({
            batchNumber,
            orderItemId: line.orderItemId,
            itemRequestId: line.itemRequestId,
            outsidePurchaseReference: line.outsidePurchaseReference,
            productUrl: line.productUrl,
            source: line.source,
            quantity: line.quantity,
            siteName: null,
          }),
        })),
      };
    },
  );

  const containerRowsRaw = await db
    .select({
      id: orderContainerItems.id,
      nameSnapshot: orderContainerItems.nameSnapshot,
      sizeSnapshot: orderContainerItems.sizeSnapshot,
      kindSnapshot: orderContainerItems.kindSnapshot,
      quantity: orderContainerItems.quantity,
      unitPriceCents: orderContainerItems.unitPriceCents,
      lineTotalCents: orderContainerItems.lineTotalCents,
    })
    .from(orderContainerItems)
    .where(eq(orderContainerItems.orderId, orderId));

  const { containerPackingRates } = await getMerchantPricingForEstimates(clerkUserId);
  let barrelCount = 0;
  let binCount = 0;
  for (const row of containerRowsRaw) {
    const kind = parseContainerOfferingKind(row.kindSnapshot);
    if (row.quantity <= 0) continue;
    if (kind === "barrel") barrelCount += row.quantity;
    else if (kind === "bin") binCount += row.quantity;
  }
  const containerPacking = await resolveContainerPackingForUserCart(
    clerkUserId,
    barrelCount,
    binCount,
    containerPackingRates,
  );

  const containerLines: CartCheckoutContainerSummaryLine[] = containerRowsRaw.map(
    (row) => {
      const kind = parseContainerOfferingKind(row.kindSnapshot);
      const containerSubtotalCents = row.lineTotalCents;
      const packagingPerUnitCents = containerPackingPerUnitCentsFromBreakdown(
        kind,
        containerPacking,
      );
      const packagingFeeCents = allocateContainerPackingFeeToLineCents({
        kind,
        quantity: row.quantity,
        barrelCount: containerPacking.barrelCount,
        binCount: containerPacking.binCount,
        rates: containerPackingRates,
      });
      return {
        id: row.id,
        nameSnapshot: row.nameSnapshot,
        sizeSnapshot: row.sizeSnapshot,
        kind,
        quantity: row.quantity,
        unitPriceCents: row.unitPriceCents,
        containerSubtotalCents,
        packagingPerUnitCents,
        packagingFeeCents,
        lineTotalCents: containerSubtotalCents + packagingFeeCents,
      };
    },
  );

  return {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    batchBundles,
    standaloneLines,
    containerLines,
  };
}
