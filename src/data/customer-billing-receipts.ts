import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import {
  batchQuoteSessionLines,
  batchQuoteSessions,
  itemRequests,
  orderItemRefunds,
  orderItems,
  orders,
} from "@/db/schema";

export type BillingReceiptScope = "order" | "single" | "batch";
export type BillingReceiptCategory = "payment" | "proration";

export type CustomerBillingReceiptRecord = {
  id: string;
  scope: BillingReceiptScope;
  category: BillingReceiptCategory;
  label: string;
  subtitle: string | null;
  amountCents: number;
  createdAt: string;
  orderId: string;
  orderItemId: string | null;
  batchNumber: string | null;
  batchSessionId: string | null;
  productName: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  searchHaystack: string;
};

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
}): CustomerBillingReceiptRecord {
  const orderId = row.id;
  const stripePaymentIntentId = row.stripePaymentIntentId?.trim() || null;

  return {
    id: `payment:${orderId}`,
    scope: "order",
    category: "payment",
    label: "Order checkout receipt",
    subtitle: `Order ${orderId}`,
    amountCents: row.totalAmount,
    createdAt: row.createdAt,
    orderId,
    orderItemId: null,
    batchNumber: null,
    batchSessionId: null,
    productName: null,
    stripePaymentIntentId,
    stripeRefundId: null,
    searchHaystack: buildSearchHaystack([
      "order checkout receipt payment",
      orderId,
      stripePaymentIntentId,
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

/** All Stripe billing receipts for a customer (order payments and proration refunds). */
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
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        isNotNull(orders.stripePaymentIntentId),
      ),
    )
    .orderBy(desc(orders.createdAt));

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
    ...paidOrders.map(paymentRecord),
    ...refundRows.map(prorationRecord),
  ];

  records.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return records;
}
