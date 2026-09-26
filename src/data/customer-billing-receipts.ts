import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrels,
  batchQuoteSessionLines,
  batchQuoteSessions,
  hubStockOrderItems,
  itemRequests,
  orderContainerItems,
  orderItemRefunds,
  orderItems,
  orders,
} from "@/db/schema";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isBarrelOutboundShippingChargeKind,
  isOffPlatformPaymentMethod,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  combinedErrorText,
  isMissingBarrelOutboundShippingChargesTableError,
} from "@/lib/db-column-missing";
import type {
  BillingReceiptCategory,
  BillingReceiptScope,
  CustomerBillingReceiptRecord,
} from "@/lib/billing-receipt-types";

export type {
  BillingReceiptCategory,
  BillingReceiptScope,
  CustomerBillingReceiptRecord,
} from "@/lib/billing-receipt-types";

const batchDirect = alias(batchQuoteSessions, "billing_rcpt_batch_direct");
const batchViaLine = alias(batchQuoteSessions, "billing_rcpt_batch_via_line");

const resolvedBatchSessionIdSel = sql<string | null>`
  CAST(
    COALESCE(
      CAST(${batchDirect.id} AS text),
      CAST(${batchViaLine.id} AS text)
    ) AS TEXT
  )
`;

const resolvedBatchNumberSel = sql<
  string | null
>`NULLIF(TRIM(COALESCE(${batchDirect.batchNumber}, ${batchViaLine.batchNumber}, '')), '')`;

function buildSearchHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function paymentRecord(row: {
  id: string;
  totalAmount: number;
  stripePaymentIntentId: string | null;
  createdAt: string;
  hubProductNames: string[];
  hasHubStock: boolean;
}): CustomerBillingReceiptRecord {
  const orderId = row.id;
  const stripePaymentIntentId = row.stripePaymentIntentId?.trim() || null;
  const uniqueNames = [...new Set(row.hubProductNames.map((name) => name.trim()).filter(Boolean))];
  const hubSubtitle =
    uniqueNames.length === 0 ? null
    : uniqueNames.length === 1 ? uniqueNames[0]!
    : uniqueNames.length === 2 ? uniqueNames.join(" · ")
    : `${uniqueNames.slice(0, 2).join(" · ")} +${uniqueNames.length - 2} more`;

  return {
    id: `payment:${orderId}`,
    scope: row.hasHubStock ? "hub" : "order",
    category: "payment",
    label: row.hasHubStock ? "In-hub product receipt" : "Order checkout receipt",
    subtitle: row.hasHubStock ? hubSubtitle ?? `Order ${orderId}` : `Order ${orderId}`,
    amountCents: row.totalAmount,
    createdAt: row.createdAt,
    orderId,
    orderItemId: null,
    batchNumber: null,
    batchSessionId: null,
    productName: uniqueNames[0] ?? null,
    stripePaymentIntentId,
    stripeRefundId: null,
    documentUrl: null,
    searchHaystack: buildSearchHaystack([
      "order checkout receipt payment",
      row.hasHubStock ? "in-hub warehouse product receipt" : null,
      orderId,
      stripePaymentIntentId,
      ...uniqueNames,
    ]),
  };
}

function prorationRecord(row: {
  refundId: string;
  amountCents: number;
  stripeRefundId: string;
  createdAt: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  batchSessionId: string | null;
  batchNumber: string | null;
}): CustomerBillingReceiptRecord {
  const batchSessionId = row.batchSessionId?.trim() || null;
  const batchNumber = row.batchNumber?.trim() || null;
  const productName = row.productName?.trim() || null;
  const scope: BillingReceiptScope = batchSessionId ? "batch" : "single";
  const subtitle =
    scope === "batch"
      ? batchNumber
        ? `Batch ${batchNumber} · ${productName ?? "Product"}`
        : productName
          ? `Batch · ${productName}`
          : "Batch proration"
      : productName ?? "Single product proration";

  return {
    id: `proration:${row.refundId}`,
    scope,
    category: "proration",
    label: "Proration receipt",
    subtitle,
    amountCents: row.amountCents,
    createdAt: row.createdAt,
    orderId: row.orderId,
    orderItemId: row.orderItemId,
    batchNumber,
    batchSessionId,
    productName,
    stripePaymentIntentId: null,
    stripeRefundId: row.stripeRefundId,
    documentUrl: null,
    searchHaystack: buildSearchHaystack([
      "proration refund receipt",
      row.orderId,
      row.orderItemId,
      row.stripeRefundId,
      productName,
      batchNumber,
      batchSessionId,
    ]),
  };
}

function shippingTransferRecord(row: {
  chargeId: string;
  chargeKind: string;
  partnerName: string | null;
  paymentMethod: string | null;
  payerName: string | null;
  receiptUrl: string;
  submittedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  amountCents: number;
  containerName: string | null;
}): CustomerBillingReceiptRecord {
  const methodLabel = isOffPlatformPaymentMethod(row.paymentMethod)
    ? OFF_PLATFORM_PAYMENT_METHOD_LABELS[row.paymentMethod]
    : "Payment";
  const kindLabel = isBarrelOutboundShippingChargeKind(row.chargeKind)
    ? BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[row.chargeKind]
    : "Shipping";
  const containerName = row.containerName?.trim() || null;
  const partnerName = row.partnerName?.trim() || null;
  const status = row.paidAt ? "Approved" : "Submitted";
  const subtitle = [kindLabel, partnerName, containerName, status]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `shipping:${row.chargeId}`,
    scope: "shipping",
    category: "transfer",
    label: `${methodLabel} receipt`,
    subtitle: subtitle || null,
    amountCents: row.amountCents,
    createdAt: row.submittedAt ?? row.paidAt ?? row.createdAt,
    orderId: null,
    orderItemId: null,
    batchNumber: null,
    batchSessionId: null,
    productName: containerName,
    stripePaymentIntentId: null,
    stripeRefundId: null,
    documentUrl: row.receiptUrl,
    searchHaystack: buildSearchHaystack([
      "shipping transfer receipt zelle cash app local office",
      methodLabel,
      kindLabel,
      partnerName,
      containerName,
      row.payerName,
      row.chargeId,
      status,
    ]),
  };
}

async function listOutboundOffPlatformReceipts(
  clerkUserId: string,
): Promise<CustomerBillingReceiptRecord[]> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  try {
    const chargeRows = await db
      .select({
        chargeId: barrelOutboundShippingCharges.id,
        chargeKind: barrelOutboundShippingCharges.chargeKind,
        partnerName: barrelOutboundShippingCharges.partnerName,
        paymentMethod: barrelOutboundShippingCharges.offPlatformPaymentMethod,
        payerName: barrelOutboundShippingCharges.offPlatformPayerName,
        receiptUrl: barrelOutboundShippingCharges.offPlatformReceiptUrl,
        submittedAt: barrelOutboundShippingCharges.offPlatformSubmittedAt,
        paidAt: barrelOutboundShippingCharges.paidAt,
        createdAt: barrelOutboundShippingCharges.createdAt,
        containerName: orderContainerItems.nameSnapshot,
      })
      .from(barrelOutboundShippingCharges)
      .innerJoin(barrels, eq(barrelOutboundShippingCharges.barrelId, barrels.id))
      .leftJoin(
        orderContainerItems,
        eq(barrels.orderContainerItemId, orderContainerItems.id),
      )
      .where(
        and(
          eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
          eq(barrels.clerkUserId, clerkUserId),
          isNotNull(barrelOutboundShippingCharges.offPlatformReceiptUrl),
          sql`NULLIF(TRIM(${barrelOutboundShippingCharges.offPlatformReceiptUrl}), '') IS NOT NULL`,
        ),
      )
      .orderBy(desc(barrelOutboundShippingCharges.offPlatformSubmittedAt));

    if (chargeRows.length === 0) {
      return [];
    }

    const chargeIds = chargeRows.map((row) => row.chargeId);
    const lineRows = await db
      .select({
        chargeId: barrelOutboundShippingChargeLines.chargeId,
        amountCents: barrelOutboundShippingChargeLines.amountCents,
      })
      .from(barrelOutboundShippingChargeLines)
      .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds));

    const amounts = new Map<string, number>();
    for (const line of lineRows) {
      const current = amounts.get(line.chargeId) ?? 0;
      amounts.set(line.chargeId, current + Math.max(0, line.amountCents));
    }

    return chargeRows.flatMap((row) => {
      const receiptUrl = row.receiptUrl?.trim();
      if (!receiptUrl) return [];
      return [
        shippingTransferRecord({
          ...row,
          receiptUrl,
          amountCents: amounts.get(row.chargeId) ?? 0,
        }),
      ];
    });
  } catch (error) {
    if (isMissingBarrelOutboundShippingChargesTableError(error)) {
      return [];
    }
    const text = combinedErrorText(error).toLowerCase();
    if (
      text.includes("off_platform_receipt_url") ||
      text.includes("does not exist")
    ) {
      return [];
    }
    throw error;
  }
}

/** Paid checkout invoices, proration refunds, and shipping transfer receipts for the signed-in customer. */
export async function listCustomerBillingReceipts(
  clerkUserId: string,
): Promise<CustomerBillingReceiptRecord[]> {
  const db = getDb();

  const paidOrders = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.clerkUserId, clerkUserId), eq(orders.status, "paid")))
    .orderBy(desc(orders.createdAt));

  const orderIds = paidOrders.map((row) => row.id);
  const hubNamesByOrderId = new Map<string, string[]>();
  if (orderIds.length > 0) {
    await ensureHubStockSchemaEnums();
    try {
      const hubRows = await db
        .select({
          orderId: hubStockOrderItems.orderId,
          nameSnapshot: hubStockOrderItems.nameSnapshot,
        })
        .from(hubStockOrderItems)
        .where(inArray(hubStockOrderItems.orderId, orderIds));
      for (const row of hubRows) {
        const list = hubNamesByOrderId.get(row.orderId) ?? [];
        const name = row.nameSnapshot.trim();
        if (name) list.push(name);
        hubNamesByOrderId.set(row.orderId, list);
      }
    } catch (error) {
      const text = combinedErrorText(error).toLowerCase();
      if (!text.includes("hub_stock_order_items") && !text.includes("does not exist")) {
        throw error;
      }
    }
  }

  const refundRows = await db
    .select({
      refundId: orderItemRefunds.id,
      amountCents: orderItemRefunds.amountCents,
      stripeRefundId: orderItemRefunds.stripeRefundId,
      createdAt: orderItemRefunds.createdAt,
      orderId: orders.id,
      orderItemId: orderItems.id,
      productName: itemRequests.productName,
      batchSessionId: resolvedBatchSessionIdSel,
      batchNumber: resolvedBatchNumberSel,
    })
    .from(orderItemRefunds)
    .innerJoin(orderItems, eq(orderItemRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(itemRequests.id, batchQuoteSessionLines.itemRequestId),
    )
    .leftJoin(
      batchViaLine,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
    )
    .where(eq(orders.clerkUserId, clerkUserId))
    .orderBy(desc(orderItemRefunds.createdAt));

  const shippingReceipts = await listOutboundOffPlatformReceipts(clerkUserId);

  const records: CustomerBillingReceiptRecord[] = [
    ...paidOrders.map((row) => {
      const hubProductNames = hubNamesByOrderId.get(row.id) ?? [];
      return paymentRecord({
        ...row,
        hubProductNames,
        hasHubStock: hubNamesByOrderId.has(row.id),
      });
    }),
    ...refundRows.map(prorationRecord),
    ...shippingReceipts,
  ];

  records.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return records;
}
