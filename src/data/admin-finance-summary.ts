import { and, eq, gte, lte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemRefunds, orderItems, orders, payments } from "@/db/schema";

export type FinanceDateRange = {
  fromIso: string;
  toIso: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function defaultFinanceDateRange(): FinanceDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

function toUtcBounds(range: FinanceDateRange): { start: string; end: string } {
  return {
    start: `${range.fromIso}T00:00:00.000Z`,
    end: `${range.toIso}T23:59:59.999Z`,
  };
}

/** Parses `YYYY-MM-DD` from URL search params; falls back to last 30 days. */
export function parseFinanceDateRange(raw: {
  from?: string;
  to?: string;
}): FinanceDateRange {
  const d = defaultFinanceDateRange();
  const from =
    raw.from && ISO_DATE.test(raw.from.trim()) ? raw.from.trim() : d.fromIso;
  const to = raw.to && ISO_DATE.test(raw.to.trim()) ? raw.to.trim() : d.toIso;
  if (from > to) {
    return { fromIso: to, toIso: from };
  }
  return { fromIso: from, toIso: to };
}

export type AdminFinanceSummary = {
  saleRevenueCents: number;
  internalQuotedSaleTaxCents: number;
  stripeReportedTaxCents: number;
  stripeFeeCents: number;
  refundsCents: number;
  paidOrderCount: number;
};

/**
 * Aggregates for admin finance. Revenue and order-based tax/fees use **paid orders whose
 * `created_at` falls in the range**. Refunds use **`order_item_refunds.created_at`** in the range.
 */
export async function getAdminFinanceSummary(
  range: FinanceDateRange,
  clerkUserId?: string,
): Promise<AdminFinanceSummary> {
  const { start, end } = toUtcBounds(range);
  const db = getDb();

  const paidInRange = clerkUserId ?
    and(
      eq(orders.status, "paid"),
      eq(orders.clerkUserId, clerkUserId),
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
    )!
  : and(
      eq(orders.status, "paid"),
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
    );

  const [revenueRow] = await db
    .select({
      total:
        sql<number>`coalesce(sum(${payments.amount}), 0)::bigint`.as("total"),
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(paidInRange);

  const [quotedTaxRow] = await db
    .select({
      total:
        sql<number>`coalesce(sum(${orders.internalQuotedSaleTaxCents}), 0)::bigint`.as(
          "total",
        ),
    })
    .from(orders)
    .where(paidInRange);

  const [stripeTaxRow] = await db
    .select({
      total:
        sql<number>`coalesce(sum(${orders.stripeTotalDetailsTaxCents}), 0)::bigint`.as(
          "total",
        ),
    })
    .from(orders)
    .where(paidInRange);

  const [feeRow] = await db
    .select({
      total:
        sql<number>`coalesce(sum(${orders.stripeFeeCents}), 0)::bigint`.as("total"),
    })
    .from(orders)
    .where(paidInRange);

  const refundTimeRange = and(
    gte(orderItemRefunds.createdAt, start),
    lte(orderItemRefunds.createdAt, end),
  );

  const [refundRow] =
    clerkUserId ?
      await db
        .select({
          total:
            sql<number>`coalesce(sum(${orderItemRefunds.amountCents}), 0)::bigint`.as(
              "total",
            ),
        })
        .from(orderItemRefunds)
        .innerJoin(orderItems, eq(orderItemRefunds.orderItemId, orderItems.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(refundTimeRange, eq(orders.clerkUserId, clerkUserId))!)
    : await db
        .select({
          total:
            sql<number>`coalesce(sum(${orderItemRefunds.amountCents}), 0)::bigint`.as(
              "total",
            ),
        })
        .from(orderItemRefunds)
        .where(refundTimeRange);

  const [countRow] = await db
    .select({
      n: sql<number>`count(*)::int`.as("n"),
    })
    .from(orders)
    .where(paidInRange);

  return {
    saleRevenueCents: Number(revenueRow?.total ?? 0),
    internalQuotedSaleTaxCents: Number(quotedTaxRow?.total ?? 0),
    stripeReportedTaxCents: Number(stripeTaxRow?.total ?? 0),
    stripeFeeCents: Number(feeRow?.total ?? 0),
    refundsCents: Number(refundRow?.total ?? 0),
    paidOrderCount: Number(countRow?.n ?? 0),
  };
}
