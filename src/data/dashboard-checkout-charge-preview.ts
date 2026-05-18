import { and, desc, eq, isNull } from "drizzle-orm";

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
} from "@/db/schema";
export type CheckoutChargeSummaryRow = {
  label: string;
  detail?: string;
  amountCents: number;
  emphasis?: boolean;
};
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { resolveContainerPackingForUserCart } from "@/data/user-cart-container-packing";
import { formatUsd } from "@/lib/admin-markup";
import {
  allocateContainerPackingFeeToLineCents,
  containerPackingPerUnitCentsFromBreakdown,
} from "@/lib/container-packing-fee";
import {
  containerOfferingKindLabel,
  parseContainerOfferingKind,
} from "@/lib/validations/container-offering";
import { batchEstimateSummaryRows } from "@/lib/admin-order-estimate-summary-rows";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";

export type CheckoutChargesProductLine = {
  name: string;
  detail?: string;
  amountCents: number;
};

export type CheckoutChargesPreview = {
  title: string;
  description: string;
  summaryRows: CheckoutChargeSummaryRow[];
  productLines: CheckoutChargesProductLine[];
};

type OrderLineRow = {
  orderItemId: string;
  itemRequestId: string;
  productName: string | null;
  productUrl: string;
  quantity: number;
  priceCents: number;
  resolvedBatchSessionId: string | null;
  resolvedBatchNumber: string | null;
};

async function loadOwnedOrder(
  clerkUserId: string,
  orderId: string,
): Promise<
  | { ok: false; message: string }
  | {
      ok: true;
      order: {
        id: string;
        totalAmount: number;
        internalQuotedSaleTaxCents: number | null;
        createdAt: string;
      };
    }
> {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      internalQuotedSaleTaxCents: orders.internalQuotedSaleTaxCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.clerkUserId, clerkUserId)))
    .limit(1);

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  return { ok: true, order };
}

async function loadOrderMerchandiseLines(
  clerkUserId: string,
  orderId: string,
): Promise<OrderLineRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      orderItemId: orderItems.id,
      itemRequestId: itemRequests.id,
      productName: itemRequests.productName,
      productUrl: itemRequests.productUrl,
      quantity: orderItems.quantity,
      priceCents: orderItems.price,
      requestBatchSessionId: itemRequests.batchQuoteSessionId,
      linkBatchSessionId: batchQuoteSessionLines.batchQuoteSessionId,
      batchNumber: batchQuoteSessions.batchNumber,
    })
    .from(orderItems)
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
    )
    .leftJoin(
      batchQuoteSessions,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchQuoteSessions.id),
    )
    .where(
      and(eq(orderItems.orderId, orderId), eq(itemRequests.clerkUserId, clerkUserId)),
    );

  return rows.map((r) => ({
    orderItemId: r.orderItemId,
    itemRequestId: r.itemRequestId,
    productName: r.productName,
    productUrl: r.productUrl,
    quantity: r.quantity,
    priceCents: r.priceCents,
    resolvedBatchSessionId:
      r.linkBatchSessionId ?? r.requestBatchSessionId ?? null,
    resolvedBatchNumber: r.batchNumber?.trim() || null,
  }));
}

async function resolveBatchEstimateForSession(
  batchSessionId: string,
  clerkUserId: string,
): Promise<BatchQuoteEstimate | null> {
  const db = getDb();
  const [session] = await db
    .select({
      id: batchQuoteSessions.id,
      cartAcceptanceAcceptedEstimateId: batchQuoteSessions.cartAcceptanceAcceptedEstimateId,
    })
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);

  if (!session) return null;

  const preferredId = session.cartAcceptanceAcceptedEstimateId;
  if (preferredId) {
    const [row] = await db
      .select()
      .from(batchQuoteEstimates)
      .where(
        and(
          eq(batchQuoteEstimates.id, preferredId),
          eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
          isNull(batchQuoteEstimates.voidedAt),
        ),
      )
      .limit(1);
    if (row) return row;
  }

  const [latest] = await db
    .select()
    .from(batchQuoteEstimates)
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
        isNull(batchQuoteEstimates.voidedAt),
      ),
    )
    .orderBy(desc(batchQuoteEstimates.createdAt))
    .limit(1);

  return latest ?? null;
}

function productLineFromOrderRow(row: OrderLineRow): CheckoutChargesProductLine {
  const name = row.productName?.trim() || "Unnamed product";
  return {
    name,
    detail: `Qty ${row.quantity} · charged at checkout`,
    amountCents: row.priceCents,
  };
}

async function loadStandaloneQuoteBreakdown(
  itemRequestId: string,
): Promise<CheckoutChargeSummaryRow[] | null> {
  const db = getDb();
  const [snap] = await db
    .select({ itemQuoteId: itemRequestLineSnapshots.itemQuoteId })
    .from(itemRequestLineSnapshots)
    .where(
      and(
        eq(itemRequestLineSnapshots.itemRequestId, itemRequestId),
        eq(itemRequestLineSnapshots.phase, "checkout_paid_pending_delivery"),
      ),
    )
    .orderBy(desc(itemRequestLineSnapshots.createdAt))
    .limit(1);

  if (!snap?.itemQuoteId) return null;

  const [quote] = await db
    .select({
      itemCost: itemQuotes.itemCost,
      serviceFee: itemQuotes.serviceFee,
      estimatedShipping: itemQuotes.estimatedShipping,
      totalPrice: itemQuotes.totalPrice,
    })
    .from(itemQuotes)
    .where(eq(itemQuotes.id, snap.itemQuoteId))
    .limit(1);

  if (!quote) return null;

  const taxCents = Math.max(
    0,
    quote.totalPrice -
      quote.itemCost -
      quote.serviceFee -
      quote.estimatedShipping,
  );

  return [
    { label: "Item cost", amountCents: quote.itemCost },
    { label: "Service & handling", amountCents: quote.serviceFee },
    { label: "Est. shipping", amountCents: quote.estimatedShipping },
    ...(taxCents > 0 ? [{ label: "Tax", amountCents: taxCents }] : []),
    {
      label: "Line total (checkout)",
      amountCents: quote.totalPrice,
      emphasis: true,
    },
  ];
}

async function loadContainerChargeRows(
  clerkUserId: string,
  orderId: string,
): Promise<CheckoutChargeSummaryRow[]> {
  const db = getDb();
  const containerRows = await db
    .select({
      nameSnapshot: orderContainerItems.nameSnapshot,
      sizeSnapshot: orderContainerItems.sizeSnapshot,
      kindSnapshot: orderContainerItems.kindSnapshot,
      quantity: orderContainerItems.quantity,
      lineTotalCents: orderContainerItems.lineTotalCents,
    })
    .from(orderContainerItems)
    .where(eq(orderContainerItems.orderId, orderId));

  if (containerRows.length === 0) return [];

  const { containerPackingRates } = await getMerchantPricingForEstimates(clerkUserId);
  let barrelCount = 0;
  let binCount = 0;
  for (const row of containerRows) {
    const kind = parseContainerOfferingKind(row.kindSnapshot);
    if (row.quantity <= 0) continue;
    if (kind === "barrel") barrelCount += row.quantity;
    else if (kind === "bin") binCount += row.quantity;
  }

  const packing = await resolveContainerPackingForUserCart(
    clerkUserId,
    barrelCount,
    binCount,
    containerPackingRates,
  );

  const rows: CheckoutChargeSummaryRow[] = [];
  for (const row of containerRows) {
    const kind = parseContainerOfferingKind(row.kindSnapshot);
    const containerSubtotal = row.lineTotalCents;
    const packagingFee = allocateContainerPackingFeeToLineCents({
      kind,
      quantity: row.quantity,
      barrelCount: packing.barrelCount,
      binCount: packing.binCount,
      rates: containerPackingRates,
    });
    const perUnit = containerPackingPerUnitCentsFromBreakdown(kind, packing);
    const charge = containerSubtotal + packagingFee;
    rows.push({
      label: row.nameSnapshot,
      detail: `${containerOfferingKindLabel(kind)} · ${row.sizeSnapshot} · qty ${row.quantity}${
        packagingFee > 0 ?
          ` · packaging ${formatUsd(perUnit)}/unit`
        : ""
      }`,
      amountCents: charge,
    });
  }

  return rows;
}

export async function loadBatchCheckoutChargesPreview(
  clerkUserId: string,
  orderId: string,
  batchSessionId: string,
): Promise<{ ok: false; message: string } | { ok: true; preview: CheckoutChargesPreview }> {
  const owned = await loadOwnedOrder(clerkUserId, orderId);
  if (!owned.ok) return owned;

  const allLines = await loadOrderMerchandiseLines(clerkUserId, orderId);
  const batchLines = allLines.filter(
    (l) => l.resolvedBatchSessionId === batchSessionId,
  );

  if (batchLines.length === 0) {
    return { ok: false, message: "No products found for this batch on the order." };
  }

  const batchNumber =
    batchLines[0]?.resolvedBatchNumber?.trim() || batchSessionId.slice(0, 8);
  const estimate = await resolveBatchEstimateForSession(batchSessionId, clerkUserId);

  const summaryRows: CheckoutChargeSummaryRow[] =
    estimate ?
      batchEstimateSummaryRows(estimate)
    : [
        {
          label: "Batch charged at checkout",
          amountCents: batchLines.reduce((s, l) => s + l.priceCents, 0),
          emphasis: true,
          detail: "Staff estimate breakdown unavailable for this batch.",
        },
      ];

  const chargedSubtotal = batchLines.reduce((s, l) => s + l.priceCents, 0);
  if (estimate && estimate.subtotalCents !== chargedSubtotal) {
    summaryRows.push({
      label: "Allocated to order lines",
      amountCents: chargedSubtotal,
      detail: "How this batch subtotal was split across products on your receipt.",
    });
  }

  return {
    ok: true,
    preview: {
      title: `Batch ${batchNumber}`,
      description: "Checkout charges for this batch bundle (staff estimate + your charged line amounts).",
      summaryRows,
      productLines: batchLines.map(productLineFromOrderRow),
    },
  };
}

export async function loadOrderCheckoutChargesPreview(
  clerkUserId: string,
  orderId: string,
): Promise<{ ok: false; message: string } | { ok: true; preview: CheckoutChargesPreview }> {
  const owned = await loadOwnedOrder(clerkUserId, orderId);
  if (!owned.ok) return owned;

  const { order } = owned;
  const merchandiseLines = await loadOrderMerchandiseLines(clerkUserId, orderId);
  const buckets = partitionPaidLinesIntoBatchBuckets(
    merchandiseLines.map((l) => ({
      ...l,
      resolvedBatchSessionId: l.resolvedBatchSessionId,
      resolvedBatchNumber: l.resolvedBatchNumber,
    })),
  );

  const summaryRows: CheckoutChargeSummaryRow[] = [];
  const productLines: CheckoutChargesProductLine[] = [];

  for (const bucket of buckets) {
    if (bucket.kind === "batch") {
      const batchSubtotal = bucket.lines.reduce((s, l) => s + l.priceCents, 0);
      const label = bucket.batchNumber ?? bucket.batchSessionId.slice(0, 8);
      summaryRows.push({
        label: `Batch ${label}`,
        detail: `${bucket.lines.length} product${bucket.lines.length === 1 ? "" : "s"}`,
        amountCents: batchSubtotal,
      });
      for (const line of bucket.lines) {
        productLines.push(productLineFromOrderRow(line));
      }
    } else {
      for (const line of bucket.lines) {
        const quoteRows = await loadStandaloneQuoteBreakdown(line.itemRequestId);
        if (quoteRows && bucket.lines.length === 1 && buckets.length === 1) {
          summaryRows.push(...quoteRows);
        } else {
          summaryRows.push({
            label: line.productName?.trim() || "Single item",
            detail: `Qty ${line.quantity}`,
            amountCents: line.priceCents,
          });
        }
        productLines.push(productLineFromOrderRow(line));
      }
    }
  }

  const merchandiseSubtotal = merchandiseLines.reduce((s, l) => s + l.priceCents, 0);
  if (summaryRows.length > 1) {
    summaryRows.push({
      label: "Product subtotal",
      amountCents: merchandiseSubtotal,
    });
  }

  const containerRows = await loadContainerChargeRows(clerkUserId, orderId);
  summaryRows.push(...containerRows);

  const accounted = merchandiseSubtotal + containerRows.reduce((s, r) => s + r.amountCents, 0);
  const remainder = order.totalAmount - accounted;
  const quotedTax = Math.max(0, order.internalQuotedSaleTaxCents ?? 0);

  if (quotedTax > 0) {
    summaryRows.push({
      label: "Estimated sales tax (checkout)",
      amountCents: quotedTax,
      detail: "Combined tax line when shown separately at checkout.",
    });
  }

  const processingAndOther = remainder - quotedTax;

  if (processingAndOther > 0) {
    summaryRows.push({
      label: "Card processing & other checkout fees",
      amountCents: processingAndOther,
      detail:
        "Pass-through processing or rounding not shown as product or container lines.",
    });
  } else if (remainder < 0) {
    summaryRows.push({
      label: "Checkout adjustments",
      amountCents: remainder,
      detail: "Order total is lower than summed line items (refunds or credits may apply).",
    });
  }

  summaryRows.push({
    label: "Order total charged",
    amountCents: order.totalAmount,
    emphasis: true,
  });

  return {
    ok: true,
    preview: {
      title: "Order checkout summary",
      description: `Charges recorded when you paid on ${new Date(order.createdAt).toLocaleString()}.`,
      summaryRows,
      productLines,
    },
  };
}
