import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { ensureMerchandiseReconciliationSchema } from "@/data/ensure-merchandise-reconciliation-schema";
import { getDb } from "@/db";
import {
  itemRequests,
  orderItemMerchandiseReconciliations,
  orderItems,
  orders,
  type OrderItemMerchandiseReconciliation,
  type OrderItemMerchandiseReconciliationStatus,
} from "@/db/schema";
import { isMissingMerchandiseReconciliationTableError } from "@/lib/db-column-missing";
import {
  MERCHANDISE_TOPUP_DEFAULT_EXPIRY_HOURS,
  merchandiseTopupPaidNetCents,
  remainingMerchandiseTopupCents,
  retailerVariableDeltaCents,
  type MerchandiseReconciliationView,
} from "@/lib/merchandise-reconciliation";

/** Anchor + related IDs, de-duplicated, same paid order, awaiting company purchase. */
export async function resolveBatchReconciliationOrderItemIds(params: {
  orderItemId: string;
  relatedOrderItemIds?: string[] | undefined;
}): Promise<
  | { ok: true; orderItemIds: string[]; clerkUserId: string; orderId: string }
  | { ok: false; message: string }
> {
  const anchor = await getPaidPendingPurchaseLineContext(params.orderItemId);
  if (!anchor) {
    return { ok: false, message: "Order line not found." };
  }
  if (anchor.fulfillmentStatus !== "paid_pending_company_purchase") {
    return {
      ok: false,
      message: "This product is not awaiting company purchase.",
    };
  }

  const unique = Array.from(
    new Set([
      params.orderItemId,
      ...(params.relatedOrderItemIds ?? []).filter((id) => id !== params.orderItemId),
    ]),
  );

  if (unique.length === 1) {
    return {
      ok: true,
      orderItemIds: unique,
      clerkUserId: anchor.clerkUserId,
      orderId: anchor.orderId,
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      orderItemId: orderItems.id,
      orderId: orders.id,
      clerkUserId: orders.clerkUserId,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orderItems.id, unique));

  if (rows.length !== unique.length) {
    return { ok: false, message: "One or more batch lines were not found." };
  }

  for (const row of rows) {
    if (row.orderStatus !== "paid") {
      return { ok: false, message: "One or more batch lines are not paid." };
    }
    if (row.orderId !== anchor.orderId || row.clerkUserId !== anchor.clerkUserId) {
      return {
        ok: false,
        message: "Batch reconciliation lines must belong to the same order.",
      };
    }
    if (row.fulfillmentStatus !== "paid_pending_company_purchase") {
      return {
        ok: false,
        message: "Every batch line must still be awaiting company purchase.",
      };
    }
  }

  return {
    ok: true,
    orderItemIds: unique,
    clerkUserId: anchor.clerkUserId,
    orderId: anchor.orderId,
  };
}

export async function upsertMerchandiseReconciliationForOrderItemIds(params: {
  orderItemIds: string[];
  clerkUserId: string;
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents: number;
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  let last: MerchandiseReconciliationView | null = null;
  for (const orderItemId of params.orderItemIds) {
    last = await upsertMerchandiseReconciliation({
      orderItemId,
      clerkUserId: params.clerkUserId,
      checkoutMerchandiseCents: params.checkoutMerchandiseCents,
      checkoutShippingCents: params.checkoutShippingCents,
      checkoutTaxCents: params.checkoutTaxCents,
      checkoutServiceCents: params.checkoutServiceCents,
      actualMerchandiseCents: params.actualMerchandiseCents,
      actualShippingCents: params.actualShippingCents,
      actualTaxCents: params.actualTaxCents,
      actualServiceCents: params.actualServiceCents,
      adminClerkUserId: params.adminClerkUserId,
    });
  }
  if (!last) {
    throw new Error("Could not save merchandise reconciliation.");
  }
  return last;
}

function toView(
  row: OrderItemMerchandiseReconciliation,
): MerchandiseReconciliationView {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    clerkUserId: row.clerkUserId,
    checkoutMerchandiseCents: row.checkoutMerchandiseCents,
    checkoutShippingCents: row.checkoutShippingCents ?? 0,
    checkoutTaxCents: row.checkoutTaxCents ?? 0,
    checkoutServiceCents: row.checkoutServiceCents ?? 0,
    actualMerchandiseCents: row.actualMerchandiseCents,
    actualShippingCents: row.actualShippingCents ?? 0,
    actualTaxCents: row.actualTaxCents ?? 0,
    actualServiceCents: row.actualServiceCents ?? 0,
    deltaCents: row.deltaCents,
    status: row.status,
    supportTicketId: row.supportTicketId,
    customerMessage: row.customerMessage,
    topupAmountCents: row.topupAmountCents,
    topupExpiresAt: row.topupExpiresAt,
    topupPaidAt: row.topupPaidAt,
    topupCheckoutOrderId: row.topupCheckoutOrderId ?? null,
    topupRefundedCents: Math.max(0, row.topupRefundedCents ?? 0),
    topupPaidTotalCents: Math.max(0, row.topupPaidTotalCents ?? 0),
    resolvedAt: row.resolvedAt,
  };
}

export async function getMerchandiseReconciliationByOrderItemId(
  orderItemId: string,
): Promise<MerchandiseReconciliationView | null> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(orderItemMerchandiseReconciliations)
      .where(eq(orderItemMerchandiseReconciliations.orderItemId, orderItemId))
      .limit(1);
    return row ? toView(row) : null;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) {
      return null;
    }
    throw e;
  }
}

/**
 * Open price-up reconciliation linked to a support ticket (customer decision prompt).
 */
export async function getMerchandiseReconciliationAwaitingDecisionByTicket(params: {
  supportTicketId: string;
  clerkUserId: string;
}): Promise<MerchandiseReconciliationView | null> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(orderItemMerchandiseReconciliations)
      .where(
        and(
          eq(
            orderItemMerchandiseReconciliations.supportTicketId,
            params.supportTicketId,
          ),
          eq(
            orderItemMerchandiseReconciliations.clerkUserId,
            params.clerkUserId,
          ),
          eq(
            orderItemMerchandiseReconciliations.status,
            "customer_notified",
          ),
        ),
      )
      .limit(1);
    if (!row || row.deltaCents <= 0) return null;
    return toView(row);
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) {
      return null;
    }
    throw e;
  }
}

/** Any open price-up recon for this customer (covers duplicate notify tickets). */
export async function getMerchandiseReconciliationAwaitingDecisionForUser(
  clerkUserId: string,
): Promise<MerchandiseReconciliationView | null> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(orderItemMerchandiseReconciliations)
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.clerkUserId, clerkUserId),
          eq(
            orderItemMerchandiseReconciliations.status,
            "customer_notified",
          ),
        ),
      )
      .limit(1);
    if (!row || row.deltaCents <= 0) return null;
    return toView(row);
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) {
      return null;
    }
    throw e;
  }
}

export type PaidPendingPurchaseLineContext = {
  orderItemId: string;
  orderId: string;
  clerkUserId: string;
  itemRequestId: string;
  productName: string | null;
  linePriceCents: number;
  fulfillmentStatus: string;
  orderStatus: string;
};

export async function getPaidPendingPurchaseLineContext(
  orderItemId: string,
): Promise<PaidPendingPurchaseLineContext | null> {
  const db = getDb();
  const [row] = await db
    .select({
      orderItemId: orderItems.id,
      orderId: orders.id,
      clerkUserId: orders.clerkUserId,
      itemRequestId: orderItems.itemRequestId,
      productName: itemRequests.productName,
      linePriceCents: orderItems.price,
      fulfillmentStatus: orderItems.fulfillmentStatus,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!row || row.orderStatus !== "paid") return null;
  return row;
}

export async function upsertMerchandiseReconciliation(params: {
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
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const grossDeltaCents = retailerVariableDeltaCents(params);
  const status: OrderItemMerchandiseReconciliationStatus =
    grossDeltaCents === 0 ? "matched" : "recorded";
  const now = new Date().toISOString();
  const resolvedAt = status === "matched" ? now : null;

  const existing = await getMerchandiseReconciliationByOrderItemId(
    params.orderItemId,
  );

  if (existing) {
    if (existing.status === "cancelled") {
      throw new Error(
        "This line was already cancelled after a price change and cannot be re-recorded.",
      );
    }

    const paidNetCents = merchandiseTopupPaidNetCents(existing);
    const remainingCents = remainingMerchandiseTopupCents({
      grossDeltaCents,
      paidNetCents,
    });

    const amountsUnchanged =
      existing.checkoutMerchandiseCents === params.checkoutMerchandiseCents &&
      existing.checkoutShippingCents === params.checkoutShippingCents &&
      existing.checkoutTaxCents === params.checkoutTaxCents &&
      existing.checkoutServiceCents === params.checkoutServiceCents &&
      existing.actualMerchandiseCents === params.actualMerchandiseCents &&
      existing.actualShippingCents === params.actualShippingCents &&
      existing.actualTaxCents === params.actualTaxCents &&
      existing.actualServiceCents === params.actualServiceCents;

    let nextStatus: OrderItemMerchandiseReconciliationStatus = status;
    if (paidNetCents > 0 && remainingCents === 0 && grossDeltaCents >= 0) {
      // Prior top-up(s) still cover the updated actuals.
      nextStatus = "topup_paid";
    } else if (paidNetCents > 0 && remainingCents > 0) {
      // Actuals rose again — reopen for an additional top-up.
      nextStatus = "recorded";
    } else if (
      amountsUnchanged &&
      (existing.status === "customer_notified" ||
        existing.status === "topup_pending")
    ) {
      nextStatus = existing.status;
    } else if (existing.status === "topup_paid" && grossDeltaCents === 0) {
      nextStatus = "matched";
    }

    const [updated] = await db
      .update(orderItemMerchandiseReconciliations)
      .set({
        checkoutMerchandiseCents: params.checkoutMerchandiseCents,
        checkoutShippingCents: params.checkoutShippingCents,
        checkoutTaxCents: params.checkoutTaxCents,
        checkoutServiceCents: params.checkoutServiceCents,
        actualMerchandiseCents: params.actualMerchandiseCents,
        actualShippingCents: params.actualShippingCents,
        actualTaxCents: params.actualTaxCents,
        actualServiceCents: params.actualServiceCents,
        deltaCents: grossDeltaCents,
        status: nextStatus,
        topupAmountCents:
          remainingCents > 0 ? remainingCents
          : paidNetCents > 0 ? existing.topupAmountCents
          : null,
        topupExpiresAt:
          nextStatus === "topup_pending" ? existing.topupExpiresAt : null,
        topupPaidAt:
          nextStatus === "topup_paid" || paidNetCents > 0 ?
            (existing.topupPaidAt ?? (nextStatus === "topup_paid" ? now : null))
          : null,
        topupPaidTotalCents: existing.topupPaidTotalCents,
        resolvedAt:
          nextStatus === "matched" || nextStatus === "topup_paid" ? now : null,
        updatedByClerkUserId: params.adminClerkUserId,
        updatedAt: now,
      })
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
          eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Could not update merchandise reconciliation.");
    }
    return toView(updated);
  }

  const [inserted] = await db
    .insert(orderItemMerchandiseReconciliations)
    .values({
      orderItemId: params.orderItemId,
      clerkUserId: params.clerkUserId,
      checkoutMerchandiseCents: params.checkoutMerchandiseCents,
      checkoutShippingCents: params.checkoutShippingCents,
      checkoutTaxCents: params.checkoutTaxCents,
      checkoutServiceCents: params.checkoutServiceCents,
      actualMerchandiseCents: params.actualMerchandiseCents,
      actualShippingCents: params.actualShippingCents,
      actualTaxCents: params.actualTaxCents,
      actualServiceCents: params.actualServiceCents,
      deltaCents: grossDeltaCents,
      status,
      topupAmountCents: grossDeltaCents > 0 ? grossDeltaCents : null,
      resolvedAt,
      createdByClerkUserId: params.adminClerkUserId,
      updatedByClerkUserId: params.adminClerkUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Could not save merchandise reconciliation.");
  }
  return toView(inserted);
}

/**
 * Refresh rows already linked to this ticket. Does not reassign other
 * batch/single scopes (those keep their own dialogue threads).
 */
export async function linkOpenMerchandiseReconciliationsToSupportTicket(params: {
  clerkUserId: string;
  supportTicketId: string;
}): Promise<void> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db
      .update(orderItemMerchandiseReconciliations)
      .set({
        updatedAt: now,
      })
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
          eq(
            orderItemMerchandiseReconciliations.supportTicketId,
            params.supportTicketId,
          ),
          eq(
            orderItemMerchandiseReconciliations.status,
            "customer_notified",
          ),
        ),
      );
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return;
    throw e;
  }
}

export async function markMerchandiseReconciliationCustomerNotified(params: {
  orderItemId: string;
  clerkUserId: string;
  supportTicketId: string;
  customerMessage: string;
  adminClerkUserId: string;
  /** When true, keep current status (e.g. already `topup_pending`). */
  preserveStatus?: boolean;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const [updated] = await db
    .update(orderItemMerchandiseReconciliations)
    .set({
      ...(params.preserveStatus ? {} : { status: "customer_notified" as const }),
      supportTicketId: params.supportTicketId,
      customerMessage: params.customerMessage,
      updatedByClerkUserId: params.adminClerkUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Merchandise reconciliation not found.");
  }
  return toView(updated);
}

export async function markMerchandiseReconciliationTopupPending(params: {
  orderItemId: string;
  clerkUserId: string;
  topupAmountCents: number;
  expiryHours?: number;
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const hours = params.expiryHours ?? MERCHANDISE_TOPUP_DEFAULT_EXPIRY_HOURS;
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [updated] = await db
    .update(orderItemMerchandiseReconciliations)
    .set({
      status: "topup_pending",
      topupAmountCents: params.topupAmountCents,
      topupExpiresAt: expires,
      topupPaidAt: null,
      resolvedAt: null,
      updatedByClerkUserId: params.adminClerkUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Merchandise reconciliation not found.");
  }
  return toView(updated);
}

/**
 * Withdraw an unpaid top-up add-on request (remove from Products Active).
 * Preserves any previously paid top-up totals.
 */
export async function revokeMerchandiseReconciliationTopupPending(params: {
  orderItemId: string;
  clerkUserId: string;
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const existing = await getMerchandiseReconciliationByOrderItemId(
    params.orderItemId,
  );
  if (!existing) {
    throw new Error("Merchandise reconciliation not found.");
  }
  if (existing.status !== "topup_pending") {
    throw new Error("No unpaid top-up request to revoke.");
  }

  const paidNet = merchandiseTopupPaidNetCents(existing);
  const nextStatus =
    paidNet > 0 ? "topup_paid"
    : existing.supportTicketId ? "customer_notified"
    : "recorded";
  const now = new Date().toISOString();
  // Reset actuals to checkout so the form can be re-entered cleanly.
  const checkoutMerchandiseCents = existing.checkoutMerchandiseCents;
  const checkoutShippingCents = existing.checkoutShippingCents;
  const checkoutTaxCents = existing.checkoutTaxCents;
  const checkoutServiceCents = existing.checkoutServiceCents;

  const [updated] = await db
    .update(orderItemMerchandiseReconciliations)
    .set({
      status: nextStatus,
      topupAmountCents: null,
      topupExpiresAt: null,
      actualMerchandiseCents: checkoutMerchandiseCents,
      actualShippingCents: checkoutShippingCents,
      actualTaxCents: checkoutTaxCents,
      actualServiceCents: checkoutServiceCents,
      deltaCents: 0,
      resolvedAt: paidNet > 0 ? (existing.resolvedAt ?? now) : null,
      updatedByClerkUserId: params.adminClerkUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
        eq(orderItemMerchandiseReconciliations.status, "topup_pending"),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Could not revoke unpaid top-up request.");
  }
  return toView(updated);
}

export async function markMerchandiseReconciliationTopupPaid(params: {
  orderItemId: string;
  clerkUserId: string;
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await getMerchandiseReconciliationByOrderItemId(
    params.orderItemId,
  );
  if (!existing) {
    throw new Error("Merchandise reconciliation not found.");
  }
  if (existing.status === "topup_paid") {
    return existing;
  }
  const addPaid = Math.max(0, existing.topupAmountCents ?? 0);
  const [updated] = await db
    .update(orderItemMerchandiseReconciliations)
    .set({
      status: "topup_paid",
      topupPaidAt: now,
      topupPaidTotalCents: existing.topupPaidTotalCents + addPaid,
      resolvedAt: now,
      updatedByClerkUserId: params.adminClerkUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Merchandise reconciliation not found.");
  }

  if (addPaid > 0 && updated.topupCheckoutOrderId) {
    const { recordMerchandiseTopupPayment } = await import(
      "@/data/merchandise-topup-refund"
    );
    await recordMerchandiseTopupPayment({
      clerkUserId: params.clerkUserId,
      checkoutOrderId: updated.topupCheckoutOrderId,
      amountCents: addPaid,
      reconciliationIds: [updated.id],
      paidAt: now,
    });
  }

  return toView(updated);
}

export async function markMerchandiseReconciliationCancelled(params: {
  orderItemId: string;
  clerkUserId: string;
  adminClerkUserId: string;
}): Promise<MerchandiseReconciliationView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const [updated] = await db
    .update(orderItemMerchandiseReconciliations)
    .set({
      status: "cancelled",
      resolvedAt: now,
      updatedByClerkUserId: params.adminClerkUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.orderItemId, params.orderItemId),
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Merchandise reconciliation not found.");
  }
  return toView(updated);
}
