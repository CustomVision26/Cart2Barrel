import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { getDb } from "@/db";
import {
  batchQuoteSessionLines,
  batchQuoteSessions,
  hubStockOrderItems,
  itemRequests,
  orderItemRefunds,
  orderItems,
  orders,
} from "@/db/schema";
import { combinedErrorText } from "@/lib/db-column-missing";
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

/** Paid checkout invoices and proration refunds for the signed-in customer. */
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
  ];

  records.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return records;
}
