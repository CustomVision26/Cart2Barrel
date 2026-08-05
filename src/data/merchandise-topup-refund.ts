import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ensureMerchandiseReconciliationSchema } from "@/data/ensure-merchandise-reconciliation-schema";
import { getDb } from "@/db";
import {
  itemRequests,
  merchandiseTopupPaymentReconciliations,
  merchandiseTopupPayments,
  orderItemMerchandiseReconciliations,
  orderItems,
  orders,
} from "@/db/schema";
import { isMissingMerchandiseReconciliationTableError } from "@/lib/db-column-missing";
import { formatMerchandiseTopupNumber } from "@/lib/merchandise-reconciliation";
import {
  formatStripeApiErrorForUi,
  getPaymentIntentRefundableCents,
  getStripeServer,
} from "@/lib/stripe-server";

export type MerchandiseTopupRefundableView = {
  /** Stable key for this Stripe top-up installment. */
  paymentId: string;
  reconciliationId: string;
  reconciliationIds: string[];
  topupCheckoutOrderId: string;
  topupNumber: string;
  productName: string;
  amountCents: number;
  refundedCents: number;
  refundableCents: number;
  paidAt: string | null;
};

/**
 * Record a collected top-up Stripe checkout so each installment can be refunded.
 */
export async function recordMerchandiseTopupPayment(params: {
  clerkUserId: string;
  checkoutOrderId: string;
  amountCents: number;
  reconciliationIds: string[];
  paidAt?: string;
}): Promise<void> {
  if (params.reconciliationIds.length === 0) return;
  const amountCents = Math.max(0, Math.round(params.amountCents));
  if (amountCents <= 0) return;
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const paidAt = params.paidAt ?? new Date().toISOString();

  try {
    const [existing] = await db
      .select({ id: merchandiseTopupPayments.id })
      .from(merchandiseTopupPayments)
      .where(eq(merchandiseTopupPayments.checkoutOrderId, params.checkoutOrderId))
      .limit(1);

    let paymentId = existing?.id ?? null;
    if (!paymentId) {
      const [inserted] = await db
        .insert(merchandiseTopupPayments)
        .values({
          clerkUserId: params.clerkUserId,
          checkoutOrderId: params.checkoutOrderId,
          amountCents,
          refundedCents: 0,
          paidAt,
        })
        .returning({ id: merchandiseTopupPayments.id });
      paymentId = inserted?.id ?? null;
    }
    if (!paymentId) return;

    for (const reconciliationId of params.reconciliationIds) {
      await db
        .insert(merchandiseTopupPaymentReconciliations)
        .values({ paymentId, reconciliationId })
        .onConflictDoNothing();
    }

    const { markMerchandiseTopupChargeBreakdownsPaid } = await import(
      "@/data/merchandise-topup-charge-breakdowns"
    );
    await markMerchandiseTopupChargeBreakdownsPaid({
      clerkUserId: params.clerkUserId,
      reconciliationIds: params.reconciliationIds,
      topupPaymentId: paymentId,
      amountCents,
    });
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return;
    throw e;
  }
}

/** Paid top-up installments linked to these merchandise lines that still have refundable balance. */
export async function listMerchandiseTopupRefundablesForOrderItems(params: {
  clerkUserId?: string;
  orderItemIds: string[];
}): Promise<MerchandiseTopupRefundableView[]> {
  if (params.orderItemIds.length === 0) return [];
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();

  try {
    const reconRows = await db
      .select({
        reconciliationId: orderItemMerchandiseReconciliations.id,
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        clerkUserId: orderItemMerchandiseReconciliations.clerkUserId,
        productName: itemRequests.productName,
      })
      .from(orderItemMerchandiseReconciliations)
      .innerJoin(
        orderItems,
        eq(orderItemMerchandiseReconciliations.orderItemId, orderItems.id),
      )
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(inArray(orderItems.id, params.orderItemIds));

    const scoped =
      params.clerkUserId ?
        reconRows.filter((r) => r.clerkUserId === params.clerkUserId)
      : reconRows;
    if (scoped.length === 0) return [];

    const reconciliationIds = scoped.map((r) => r.reconciliationId);
    const productByRecon = new Map(
      scoped.map((r) => [
        r.reconciliationId,
        r.productName?.trim() || "Order product",
      ]),
    );

    const paymentLinks = await db
      .select({
        paymentId: merchandiseTopupPayments.id,
        checkoutOrderId: merchandiseTopupPayments.checkoutOrderId,
        amountCents: merchandiseTopupPayments.amountCents,
        refundedCents: merchandiseTopupPayments.refundedCents,
        paidAt: merchandiseTopupPayments.paidAt,
        reconciliationId: merchandiseTopupPaymentReconciliations.reconciliationId,
      })
      .from(merchandiseTopupPaymentReconciliations)
      .innerJoin(
        merchandiseTopupPayments,
        eq(
          merchandiseTopupPaymentReconciliations.paymentId,
          merchandiseTopupPayments.id,
        ),
      )
      .where(
        and(
          inArray(
            merchandiseTopupPaymentReconciliations.reconciliationId,
            reconciliationIds,
          ),
          params.clerkUserId ?
            eq(merchandiseTopupPayments.clerkUserId, params.clerkUserId)
          : sql`true`,
        ),
      )
      .orderBy(desc(merchandiseTopupPayments.paidAt));

    const byPayment = new Map<
      string,
      {
        paymentId: string;
        checkoutOrderId: string;
        amountCents: number;
        refundedCents: number;
        paidAt: string | null;
        reconciliationIds: string[];
      }
    >();

    for (const row of paymentLinks) {
      const existing = byPayment.get(row.paymentId);
      if (existing) {
        if (!existing.reconciliationIds.includes(row.reconciliationId)) {
          existing.reconciliationIds.push(row.reconciliationId);
        }
        continue;
      }
      byPayment.set(row.paymentId, {
        paymentId: row.paymentId,
        checkoutOrderId: row.checkoutOrderId,
        amountCents: Math.max(0, row.amountCents),
        refundedCents: Math.max(0, row.refundedCents),
        paidAt: row.paidAt,
        reconciliationIds: [row.reconciliationId],
      });
    }

    const out: MerchandiseTopupRefundableView[] = [];
    for (const payment of byPayment.values()) {
      const refundableCents = Math.max(
        0,
        payment.amountCents - payment.refundedCents,
      );
      if (refundableCents <= 0) continue;

      const productNames = payment.reconciliationIds.map(
        (id) => productByRecon.get(id) ?? "Order product",
      );
      const uniqueNames = Array.from(new Set(productNames));
      const primaryReconId = payment.reconciliationIds[0]!;
      const productName =
        uniqueNames.length > 1 ?
          `Purchase price top-up — batch (${uniqueNames.length} products)`
        : `Purchase price top-up — ${uniqueNames[0]}`;

      out.push({
        paymentId: payment.paymentId,
        reconciliationId: primaryReconId,
        reconciliationIds: payment.reconciliationIds,
        topupCheckoutOrderId: payment.checkoutOrderId,
        topupNumber: formatMerchandiseTopupNumber(primaryReconId),
        productName,
        amountCents: payment.amountCents,
        refundedCents: payment.refundedCents,
        refundableCents,
        paidAt: payment.paidAt,
      });
    }

    return out;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return [];
    throw e;
  }
}

export async function performMerchandiseTopupStripeRefund(params: {
  topupCheckoutOrderId: string;
  reconciliationIds: string[];
  amountCentsRequested: number;
  internalReasonForDb: string | null;
  createdByClerkUserId: string;
  paymentId?: string;
}): Promise<
  | { ok: true; refundedCents: number; stripeRefundId: string }
  | { ok: false; message: string }
> {
  if (params.reconciliationIds.length === 0) {
    return { ok: false, message: "Missing top-up reconciliation." };
  }
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      clerkUserId: orders.clerkUserId,
    })
    .from(orders)
    .where(eq(orders.id, params.topupCheckoutOrderId))
    .limit(1);

  if (!order || order.status !== "paid" || !order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "Top-up payment order was not found or is not refundable.",
    };
  }

  const paymentQuery =
    params.paymentId ?
      and(
        eq(merchandiseTopupPayments.id, params.paymentId),
        eq(merchandiseTopupPayments.checkoutOrderId, params.topupCheckoutOrderId),
        eq(merchandiseTopupPayments.clerkUserId, order.clerkUserId),
      )
    : and(
        eq(merchandiseTopupPayments.checkoutOrderId, params.topupCheckoutOrderId),
        eq(merchandiseTopupPayments.clerkUserId, order.clerkUserId),
      );

  const [payment] = await db
    .select({
      id: merchandiseTopupPayments.id,
      amountCents: merchandiseTopupPayments.amountCents,
      refundedCents: merchandiseTopupPayments.refundedCents,
    })
    .from(merchandiseTopupPayments)
    .where(paymentQuery)
    .limit(1);

  if (!payment) {
    return {
      ok: false,
      message: "Top-up payment record was not found for this checkout.",
    };
  }

  const lineRemaining = Math.max(
    0,
    payment.amountCents - payment.refundedCents,
  );
  if (lineRemaining <= 0) {
    return { ok: false, message: "This top-up has already been fully refunded." };
  }

  const piRemaining = await getPaymentIntentRefundableCents(
    order.stripePaymentIntentId,
  );
  if (piRemaining === null || piRemaining <= 0) {
    return {
      ok: false,
      message:
        "Could not read the Stripe charge for this top-up, or nothing is left to refund.",
    };
  }

  const refundCents = Math.min(
    params.amountCentsRequested,
    lineRemaining,
    piRemaining,
  );
  if (refundCents < 1) {
    return {
      ok: false,
      message: "Refund amount is too small or nothing is refundable.",
    };
  }

  const stripe = getStripeServer();
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: {
        order_id: order.id,
        merchandise_topup: "1",
        topup_payment_id: payment.id,
        reconciliation_ids: params.reconciliationIds.join(",").slice(0, 450),
      },
    });
    stripeRefundId = refund.id;
  } catch (e) {
    const detail = formatStripeApiErrorForUi(e);
    return {
      ok: false,
      message:
        detail ?
          `Stripe could not process the top-up refund: ${detail}`
        : "Stripe could not process the top-up refund.",
    };
  }

  const now = new Date().toISOString();
  const newPaymentRefunded = payment.refundedCents + refundCents;
  await db
    .update(merchandiseTopupPayments)
    .set({ refundedCents: newPaymentRefunded })
    .where(eq(merchandiseTopupPayments.id, payment.id));

  // Keep aggregate refunded cents on each linked reconciliation in sync.
  const linked = await db
    .select({
      reconciliationId: merchandiseTopupPaymentReconciliations.reconciliationId,
    })
    .from(merchandiseTopupPaymentReconciliations)
    .where(eq(merchandiseTopupPaymentReconciliations.paymentId, payment.id));

  const linkedIds =
    linked.length > 0 ?
      linked.map((l) => l.reconciliationId)
    : params.reconciliationIds;

  for (const reconciliationId of linkedIds) {
    const [sums] = await db
      .select({
        refunded: sql<number>`coalesce(sum(${merchandiseTopupPayments.refundedCents}), 0)`,
      })
      .from(merchandiseTopupPaymentReconciliations)
      .innerJoin(
        merchandiseTopupPayments,
        eq(
          merchandiseTopupPaymentReconciliations.paymentId,
          merchandiseTopupPayments.id,
        ),
      )
      .where(
        eq(
          merchandiseTopupPaymentReconciliations.reconciliationId,
          reconciliationId,
        ),
      );

    await db
      .update(orderItemMerchandiseReconciliations)
      .set({
        topupRefundedCents: Math.max(0, Number(sums?.refunded ?? 0)),
        updatedByClerkUserId: params.createdByClerkUserId,
        updatedAt: now,
      })
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.id, reconciliationId),
          eq(orderItemMerchandiseReconciliations.clerkUserId, order.clerkUserId),
        ),
      );
  }

  return { ok: true, refundedCents: refundCents, stripeRefundId };
}
