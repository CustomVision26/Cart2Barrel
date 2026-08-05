import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ensureMerchandiseReconciliationSchema } from "@/data/ensure-merchandise-reconciliation-schema";
import { recordMerchandiseTopupPayment } from "@/data/merchandise-topup-refund";
import { getDb } from "@/db";
import {
  batchQuoteSessions,
  itemRequests,
  orderItemMerchandiseReconciliations,
  orderItems,
  orders,
  userMerchandiseTopupCartLines,
} from "@/db/schema";
import type { StripeCheckoutPriceDataLine } from "@/data/cart";
import { isMissingMerchandiseReconciliationTableError } from "@/lib/db-column-missing";
import {
  formatMerchandiseTopupNumber,
  merchandiseTopupPaidNetCents,
} from "@/lib/merchandise-reconciliation";
import { formatItemRequestProductNumber } from "@/lib/quote-expiry";

export type MerchandiseTopupChargeBreakdown = {
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents: number;
  deltaCents: number;
};

export type MerchandiseTopupChargeLineView = {
  orderItemId: string;
  itemRequestId: string;
  productName: string;
  /** Customer-facing product # (item request short id / OP reference). */
  productNumber: string;
  quantity: number;
};

export type MerchandiseTopupAddOnChargeView = {
  /** Representative reconciliation id used as the cart key. */
  reconciliationId: string;
  /** All reconciliations paid together (batch siblings). */
  reconciliationIds: string[];
  supportTicketId: string | null;
  orderId: string;
  orderItemIds: string[];
  amountCents: number;
  /** Paid top-up net before this pending installment (from frozen snapshot). */
  priorPaidNetCents?: number;
  expiresAt: string | null;
  inCart: boolean;
  productName: string;
  productNames: string[];
  /** Primary / representative product # (first line). */
  productNumber: string;
  /** Checkout batch quote number when lines share a batch session. */
  batchNumber: string | null;
  /** Customer-facing top-up reference (e.g. TOP-A1B2C3D4). */
  topupNumber: string;
  /** When this top-up charge was requested / submitted for the customer. */
  submittedAt: string | null;
  lines: MerchandiseTopupChargeLineView[];
  imageUrl: string | null;
  siteLabel: string | null;
  productUrl: string | null;
  quantity: number;
  breakdown: MerchandiseTopupChargeBreakdown;
};

export type MerchandiseTopupCartLineView = MerchandiseTopupAddOnChargeView;

function groupKey(row: {
  supportTicketId: string | null;
  reconciliationId: string;
}): string {
  return row.supportTicketId?.trim() || row.reconciliationId;
}

export async function listMerchandiseTopupAddOnChargesForUser(
  clerkUserId: string,
): Promise<MerchandiseTopupAddOnChargeView[]> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();

  try {
    const rows = await db
      .select({
        reconciliationId: orderItemMerchandiseReconciliations.id,
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        orderId: orders.id,
        orderItemId: orderItems.id,
        amountCents: orderItemMerchandiseReconciliations.topupAmountCents,
        expiresAt: orderItemMerchandiseReconciliations.topupExpiresAt,
        updatedAt: orderItemMerchandiseReconciliations.updatedAt,
        quantity: orderItems.quantity,
        itemRequestId: itemRequests.id,
        outsidePurchaseReference: itemRequests.outsidePurchaseReference,
        batchQuoteSessionId: itemRequests.batchQuoteSessionId,
        productName: itemRequests.productName,
        productUrl: itemRequests.productUrl,
        imageUrl: itemRequests.productImageUrl,
        siteName: itemRequests.siteName,
        checkoutMerchandiseCents:
          orderItemMerchandiseReconciliations.checkoutMerchandiseCents,
        checkoutShippingCents:
          orderItemMerchandiseReconciliations.checkoutShippingCents,
        checkoutTaxCents: orderItemMerchandiseReconciliations.checkoutTaxCents,
        checkoutServiceCents:
          orderItemMerchandiseReconciliations.checkoutServiceCents,
        actualMerchandiseCents:
          orderItemMerchandiseReconciliations.actualMerchandiseCents,
        actualShippingCents:
          orderItemMerchandiseReconciliations.actualShippingCents,
        actualTaxCents: orderItemMerchandiseReconciliations.actualTaxCents,
        actualServiceCents:
          orderItemMerchandiseReconciliations.actualServiceCents,
        deltaCents: orderItemMerchandiseReconciliations.deltaCents,
      })
      .from(orderItemMerchandiseReconciliations)
      .innerJoin(
        orderItems,
        eq(orderItemMerchandiseReconciliations.orderItemId, orderItems.id),
      )
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.clerkUserId, clerkUserId),
          eq(orders.clerkUserId, clerkUserId),
          eq(orderItemMerchandiseReconciliations.status, "topup_pending"),
          sql`${orderItemMerchandiseReconciliations.topupAmountCents} > 0`,
          sql`(
            ${orderItemMerchandiseReconciliations.topupExpiresAt} IS NULL
            OR ${orderItemMerchandiseReconciliations.topupExpiresAt} > now()
          )`,
        ),
      )
      .orderBy(desc(orderItemMerchandiseReconciliations.updatedAt));

    if (rows.length === 0) return [];

    const cartRows = await db
      .select({
        reconciliationId: userMerchandiseTopupCartLines.reconciliationId,
      })
      .from(userMerchandiseTopupCartLines)
      .where(eq(userMerchandiseTopupCartLines.clerkUserId, clerkUserId));
    const inCartIds = new Set(cartRows.map((r) => r.reconciliationId));

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = groupKey({
        supportTicketId: row.supportTicketId,
        reconciliationId: row.reconciliationId,
      });
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const batchSessionIds = Array.from(
      new Set(
        rows
          .map((r) => r.batchQuoteSessionId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const batchNumberBySessionId = new Map<string, string>();
    if (batchSessionIds.length > 0) {
      const batchRows = await db
        .select({
          id: batchQuoteSessions.id,
          batchNumber: batchQuoteSessions.batchNumber,
          clerkUserId: batchQuoteSessions.clerkUserId,
        })
        .from(batchQuoteSessions)
        .where(
          and(
            eq(batchQuoteSessions.clerkUserId, clerkUserId),
            inArray(batchQuoteSessions.id, batchSessionIds),
          ),
        );
      for (const b of batchRows) {
        const n = b.batchNumber?.trim();
        if (n) batchNumberBySessionId.set(b.id, n);
      }
    }

    const charges: MerchandiseTopupAddOnChargeView[] = [];
    for (const group of groups.values()) {
      const primary = group[0]!;
      const amountCents = Math.max(0, primary.amountCents ?? 0);
      if (amountCents <= 0) continue;

      const reconciliationIds = group.map((r) => r.reconciliationId);
      const lines: MerchandiseTopupChargeLineView[] = group.map((r) => ({
        orderItemId: r.orderItemId,
        itemRequestId: r.itemRequestId,
        productName: r.productName?.trim() || "Order product",
        productNumber: formatItemRequestProductNumber({
          id: r.itemRequestId,
          outsidePurchaseReference: r.outsidePurchaseReference,
        }),
        quantity: Math.max(0, r.quantity),
      }));
      const productNames = lines.map((l) => l.productName);
      const isBatch = lines.length > 1;
      const productName =
        isBatch ?
          `Purchase price top-up — batch (${lines.length} products)`
        : `Purchase price top-up — ${productNames[0]}`;

      const sessionIds = Array.from(
        new Set(
          group
            .map((r) => r.batchQuoteSessionId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const batchNumber =
        sessionIds.length === 1 ?
          (batchNumberBySessionId.get(sessionIds[0]!) ?? null)
        : null;

      const {
        getLatestPendingMerchandiseTopupChargeBreakdown,
        merchandiseTopupBreakdownGroupKey,
      } = await import("@/data/merchandise-topup-charge-breakdowns");
      const pendingSnapshot =
        await getLatestPendingMerchandiseTopupChargeBreakdown({
          clerkUserId,
          groupKey: merchandiseTopupBreakdownGroupKey({
            supportTicketId: primary.supportTicketId,
            reconciliationId: primary.reconciliationId,
          }),
        });
      const breakdown =
        pendingSnapshot?.breakdown ?? {
          checkoutMerchandiseCents: primary.checkoutMerchandiseCents,
          checkoutShippingCents: primary.checkoutShippingCents,
          checkoutTaxCents: primary.checkoutTaxCents,
          checkoutServiceCents: primary.checkoutServiceCents,
          actualMerchandiseCents: primary.actualMerchandiseCents,
          actualShippingCents: primary.actualShippingCents,
          actualTaxCents: primary.actualTaxCents,
          actualServiceCents: primary.actualServiceCents,
          deltaCents: primary.deltaCents,
        };

      charges.push({
        reconciliationId: primary.reconciliationId,
        reconciliationIds,
        supportTicketId: primary.supportTicketId,
        orderId: primary.orderId,
        orderItemIds: group.map((r) => r.orderItemId),
        amountCents: pendingSnapshot?.amountCents ?? amountCents,
        priorPaidNetCents: pendingSnapshot?.priorPaidNetCents,
        expiresAt: pendingSnapshot?.topupExpiresAt ?? primary.expiresAt,
        inCart: reconciliationIds.some((id) => inCartIds.has(id)),
        productName,
        productNames,
        productNumber: lines[0]!.productNumber,
        batchNumber,
        topupNumber: formatMerchandiseTopupNumber(primary.reconciliationId),
        submittedAt: pendingSnapshot?.createdAt ?? primary.updatedAt ?? null,
        lines,
        imageUrl: primary.imageUrl,
        siteLabel: primary.siteName?.trim() || null,
        productUrl: primary.productUrl,
        quantity: lines.reduce((sum, l) => sum + l.quantity, 0),
        breakdown,
      });
    }

    return charges;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return [];
    throw e;
  }
}

export async function listUserMerchandiseTopupCartLines(
  clerkUserId: string,
): Promise<MerchandiseTopupCartLineView[]> {
  const charges = await listMerchandiseTopupAddOnChargesForUser(clerkUserId);
  return charges.filter((c) => c.inCart);
}

export function sumMerchandiseTopupCartLinesCents(
  lines: MerchandiseTopupCartLineView[],
): number {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export async function countUserMerchandiseTopupCartLineRows(
  clerkUserId: string,
): Promise<number> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const rows = await db
      .select({ id: userMerchandiseTopupCartLines.id })
      .from(userMerchandiseTopupCartLines)
      .where(eq(userMerchandiseTopupCartLines.clerkUserId, clerkUserId));
    return rows.length;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return 0;
    throw e;
  }
}

export async function addMerchandiseTopupToCart(params: {
  clerkUserId: string;
  reconciliationId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const charges = await listMerchandiseTopupAddOnChargesForUser(
    params.clerkUserId,
  );
  const charge = charges.find(
    (c) =>
      c.reconciliationId === params.reconciliationId ||
      c.reconciliationIds.includes(params.reconciliationId),
  );
  if (!charge) {
    return { ok: false, message: "Add-on charge not found or expired." };
  }
  if (charge.inCart) {
    return { ok: true };
  }

  const db = getDb();
  await db
    .insert(userMerchandiseTopupCartLines)
    .values({
      clerkUserId: params.clerkUserId,
      reconciliationId: charge.reconciliationId,
    })
    .onConflictDoNothing();

  return { ok: true };
}

export async function removeMerchandiseTopupFromCart(params: {
  clerkUserId: string;
  reconciliationId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .delete(userMerchandiseTopupCartLines)
    .where(
      and(
        eq(userMerchandiseTopupCartLines.clerkUserId, params.clerkUserId),
        eq(
          userMerchandiseTopupCartLines.reconciliationId,
          params.reconciliationId,
        ),
      ),
    );
}

export async function clearMerchandiseTopupCartForReconciliations(
  clerkUserId: string,
  reconciliationIds: string[],
): Promise<void> {
  if (reconciliationIds.length === 0) return;
  const db = getDb();
  await db
    .delete(userMerchandiseTopupCartLines)
    .where(
      and(
        eq(userMerchandiseTopupCartLines.clerkUserId, clerkUserId),
        inArray(
          userMerchandiseTopupCartLines.reconciliationId,
          reconciliationIds,
        ),
      ),
    );
}

export async function restoreMerchandiseTopupCartForReconciliations(
  clerkUserId: string,
  reconciliationIds: string[],
): Promise<void> {
  if (reconciliationIds.length === 0) return;
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  for (const reconciliationId of reconciliationIds) {
    await db
      .insert(userMerchandiseTopupCartLines)
      .values({ clerkUserId, reconciliationId })
      .onConflictDoNothing();
  }
}

/** Expand cart representative ids to every sibling reconciliation in the charge group. */
export async function expandMerchandiseTopupReconciliationIdsForPayment(params: {
  clerkUserId: string;
  representativeIds: string[];
}): Promise<string[]> {
  if (params.representativeIds.length === 0) return [];
  const charges = await listMerchandiseTopupAddOnChargesForUser(
    params.clerkUserId,
  );
  const ids = new Set<string>();
  for (const id of params.representativeIds) {
    const charge = charges.find(
      (c) => c.reconciliationId === id || c.reconciliationIds.includes(id),
    );
    if (charge) {
      for (const rid of charge.reconciliationIds) ids.add(rid);
    } else {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export async function markMerchandiseTopupsPaidForCheckout(params: {
  clerkUserId: string;
  reconciliationIds: string[];
  /** Order that collected the Stripe top-up payment (add-on checkout). */
  checkoutOrderId: string;
}): Promise<void> {
  if (params.reconciliationIds.length === 0) return;
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const pending = await db
    .select({
      id: orderItemMerchandiseReconciliations.id,
      topupAmountCents: orderItemMerchandiseReconciliations.topupAmountCents,
      deltaCents: orderItemMerchandiseReconciliations.deltaCents,
      topupPaidTotalCents:
        orderItemMerchandiseReconciliations.topupPaidTotalCents,
    })
    .from(orderItemMerchandiseReconciliations)
    .where(
      and(
        eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
        inArray(
          orderItemMerchandiseReconciliations.id,
          params.reconciliationIds,
        ),
        eq(orderItemMerchandiseReconciliations.status, "topup_pending"),
      ),
    );

  const paidReconciliationIds: string[] = [];
  let paymentAmountCents = 0;
  for (const row of pending) {
    const addPaid = Math.max(0, row.topupAmountCents ?? row.deltaCents);
    if (addPaid <= 0) continue;
    paymentAmountCents = Math.max(paymentAmountCents, addPaid);
    paidReconciliationIds.push(row.id);
    await db
      .update(orderItemMerchandiseReconciliations)
      .set({
        status: "topup_paid",
        topupPaidAt: now,
        topupCheckoutOrderId: params.checkoutOrderId,
        topupPaidTotalCents: Math.max(0, row.topupPaidTotalCents ?? 0) + addPaid,
        resolvedAt: now,
        updatedByClerkUserId: params.clerkUserId,
        updatedAt: now,
      })
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.id, row.id),
          eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
        ),
      );
  }

  if (paidReconciliationIds.length > 0 && paymentAmountCents > 0) {
    await recordMerchandiseTopupPayment({
      clerkUserId: params.clerkUserId,
      checkoutOrderId: params.checkoutOrderId,
      amountCents: paymentAmountCents,
      reconciliationIds: paidReconciliationIds,
      paidAt: now,
    });
  }
}

export function buildStripeLineItemsFromMerchandiseTopupCart(
  lines: MerchandiseTopupCartLineView[],
): StripeCheckoutPriceDataLine[] {
  return lines.map((line) => ({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: line.amountCents,
      product_data: {
        name: line.productName,
        description:
          line.productNames.length > 1 ?
            line.productNames.join(" · ")
          : "Retailer price difference (merchandise, shipping, tax, and/or service & handling)",
      },
    },
  }));
}

export function parseMerchandiseTopupReconciliationIdsFromMetadata(
  raw: string | undefined,
): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.length > 0);
}

/** Paid top-up add-on attached to merchandise order lines (shown on Batch / Order charges). */
export type PaidMerchandiseTopupAddOnView = {
  reconciliationId: string;
  reconciliationIds: string[];
  amountCents: number;
  /**
   * Earlier installment(s) paid before this one (from frozen snapshots when
   * available; otherwise paid total − latest `topupAmountCents`).
   */
  priorPaidInstallmentCents: number;
  /** Stable id of the frozen breakdown row when loaded from history. */
  breakdownId?: string;
  /** 1-based installment index when multiple top-ups exist for the same charge. */
  installmentIndex?: number;
  topupNumber: string;
  batchNumber: string | null;
  productName: string;
  productNames: string[];
  /** Checkout order that collected this top-up payment. */
  topupCheckoutOrderId: string | null;
  topupPaidAt: string | null;
  lines: MerchandiseTopupChargeLineView[];
  breakdown: MerchandiseTopupChargeBreakdown;
};

/**
 * Paid purchase-price top-ups for merchandise lines on an order (grouped like cart charges).
 * Includes top-up checkout order id when stored / resolvable.
 */
export async function listPaidMerchandiseTopupAddOnsForOrderItems(params: {
  clerkUserId: string;
  orderItemIds: string[];
}): Promise<PaidMerchandiseTopupAddOnView[]> {
  if (params.orderItemIds.length === 0) return [];
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();

  try {
    const rows = await db
      .select({
        reconciliationId: orderItemMerchandiseReconciliations.id,
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        topupAmountCents: orderItemMerchandiseReconciliations.topupAmountCents,
        topupPaidTotalCents:
          orderItemMerchandiseReconciliations.topupPaidTotalCents,
        topupRefundedCents:
          orderItemMerchandiseReconciliations.topupRefundedCents,
        topupPaidAt: orderItemMerchandiseReconciliations.topupPaidAt,
        topupCheckoutOrderId:
          orderItemMerchandiseReconciliations.topupCheckoutOrderId,
        orderItemId: orderItems.id,
        itemRequestId: itemRequests.id,
        outsidePurchaseReference: itemRequests.outsidePurchaseReference,
        batchQuoteSessionId: itemRequests.batchQuoteSessionId,
        productName: itemRequests.productName,
        quantity: orderItems.quantity,
        checkoutMerchandiseCents:
          orderItemMerchandiseReconciliations.checkoutMerchandiseCents,
        checkoutShippingCents:
          orderItemMerchandiseReconciliations.checkoutShippingCents,
        checkoutTaxCents: orderItemMerchandiseReconciliations.checkoutTaxCents,
        checkoutServiceCents:
          orderItemMerchandiseReconciliations.checkoutServiceCents,
        actualMerchandiseCents:
          orderItemMerchandiseReconciliations.actualMerchandiseCents,
        actualShippingCents:
          orderItemMerchandiseReconciliations.actualShippingCents,
        actualTaxCents: orderItemMerchandiseReconciliations.actualTaxCents,
        actualServiceCents:
          orderItemMerchandiseReconciliations.actualServiceCents,
        deltaCents: orderItemMerchandiseReconciliations.deltaCents,
      })
      .from(orderItemMerchandiseReconciliations)
      .innerJoin(
        orderItems,
        eq(orderItemMerchandiseReconciliations.orderItemId, orderItems.id),
      )
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .where(
        and(
          eq(orderItemMerchandiseReconciliations.clerkUserId, params.clerkUserId),
          inArray(orderItems.id, params.orderItemIds),
          sql`(
            COALESCE(${orderItemMerchandiseReconciliations.topupPaidTotalCents}, 0) > 0
            OR (
              ${orderItemMerchandiseReconciliations.status} = 'topup_paid'
              AND COALESCE(${orderItemMerchandiseReconciliations.topupAmountCents}, 0) > 0
            )
          )`,
        ),
      )
      .orderBy(desc(orderItemMerchandiseReconciliations.topupPaidAt));

    if (rows.length === 0) return [];

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = groupKey({
        supportTicketId: row.supportTicketId,
        reconciliationId: row.reconciliationId,
      });
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const batchSessionIds = Array.from(
      new Set(
        rows
          .map((r) => r.batchQuoteSessionId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const batchNumberBySessionId = new Map<string, string>();
    if (batchSessionIds.length > 0) {
      const batchRows = await db
        .select({
          id: batchQuoteSessions.id,
          batchNumber: batchQuoteSessions.batchNumber,
        })
        .from(batchQuoteSessions)
        .where(
          and(
            eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
            inArray(batchQuoteSessions.id, batchSessionIds),
          ),
        );
      for (const b of batchRows) {
        const n = b.batchNumber?.trim();
        if (n) batchNumberBySessionId.set(b.id, n);
      }
    }

    const needsOrderResolve = Array.from(groups.values()).some((group) =>
      group.every((r) => !r.topupCheckoutOrderId),
    );
    const candidateOrders =
      needsOrderResolve ?
        await db
          .select({
            id: orders.id,
            totalAmount: orders.totalAmount,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(
            and(
              eq(orders.clerkUserId, params.clerkUserId),
              eq(orders.status, "paid"),
            ),
          )
          .orderBy(desc(orders.createdAt))
          .limit(40)
      : [];

    const {
      listMerchandiseTopupChargeBreakdownsForGroup,
      listPaidMerchandiseTopupChargeBreakdownsForReconciliations,
      merchandiseTopupBreakdownGroupKey,
    } = await import("@/data/merchandise-topup-charge-breakdowns");

    const addOns: PaidMerchandiseTopupAddOnView[] = [];
    for (const group of groups.values()) {
      const primary = group[0]!;
      const amountCents = merchandiseTopupPaidNetCents({
        topupPaidTotalCents: primary.topupPaidTotalCents,
        topupAmountCents: primary.topupAmountCents,
        topupPaidAt: primary.topupPaidAt,
        topupRefundedCents: primary.topupRefundedCents,
      });
      if (amountCents <= 0) continue;

      const lines: MerchandiseTopupChargeLineView[] = group.map((r) => ({
        orderItemId: r.orderItemId,
        itemRequestId: r.itemRequestId,
        productName: r.productName?.trim() || "Order product",
        productNumber: formatItemRequestProductNumber({
          id: r.itemRequestId,
          outsidePurchaseReference: r.outsidePurchaseReference,
        }),
        quantity: Math.max(0, r.quantity),
      }));
      const productNames = lines.map((l) => l.productName);
      const isBatch = lines.length > 1;
      const productName =
        isBatch ?
          `Purchase price top-up — batch (${lines.length} products)`
        : `Purchase price top-up — ${productNames[0]}`;

      const sessionIds = Array.from(
        new Set(
          group
            .map((r) => r.batchQuoteSessionId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const batchNumber =
        sessionIds.length === 1 ?
          (batchNumberBySessionId.get(sessionIds[0]!) ?? null)
        : null;

      let topupCheckoutOrderId =
        group.map((r) => r.topupCheckoutOrderId).find(Boolean) ?? null;

      if (!topupCheckoutOrderId && primary.topupPaidAt) {
        const paidAtMs = Date.parse(primary.topupPaidAt);
        const match = candidateOrders.find((o) => {
          if (o.totalAmount !== amountCents) return false;
          const createdMs = Date.parse(o.createdAt);
          if (!Number.isFinite(paidAtMs) || !Number.isFinite(createdMs)) {
            return false;
          }
          return Math.abs(createdMs - paidAtMs) <= 6 * 60 * 60 * 1000;
        });
        if (match) {
          topupCheckoutOrderId = match.id;
          await db
            .update(orderItemMerchandiseReconciliations)
            .set({ topupCheckoutOrderId: match.id })
            .where(
              and(
                eq(
                  orderItemMerchandiseReconciliations.clerkUserId,
                  params.clerkUserId,
                ),
                inArray(
                  orderItemMerchandiseReconciliations.id,
                  group.map((r) => r.reconciliationId),
                ),
              ),
            );
        }
      }

      const reconciliationIds = group.map((r) => r.reconciliationId);
      const groupKey = merchandiseTopupBreakdownGroupKey({
        supportTicketId: primary.supportTicketId,
        reconciliationId: primary.reconciliationId,
      });
      const paidFromGroup =
        await listMerchandiseTopupChargeBreakdownsForGroup({
          clerkUserId: params.clerkUserId,
          groupKey,
        });
      const paidSnapshots = paidFromGroup.filter((b) => b.status === "paid");
      const paidFromRecons =
        paidSnapshots.length > 0 ?
          []
        : await listPaidMerchandiseTopupChargeBreakdownsForReconciliations({
            clerkUserId: params.clerkUserId,
            reconciliationIds,
          });
      const snapshots =
        paidSnapshots.length > 0 ? paidSnapshots : paidFromRecons;

      if (snapshots.length > 0) {
        snapshots.forEach((snap, index) => {
          addOns.push({
            reconciliationId: primary.reconciliationId,
            reconciliationIds,
            amountCents: snap.amountCents,
            priorPaidInstallmentCents: snap.priorPaidNetCents,
            breakdownId: snap.id,
            installmentIndex: index + 1,
            topupNumber: formatMerchandiseTopupNumber(primary.reconciliationId),
            batchNumber,
            productName:
              snapshots.length > 1 ?
                `${productName} · top-up ${index + 1}`
              : productName,
            productNames,
            topupCheckoutOrderId,
            topupPaidAt: snap.createdAt,
            lines,
            breakdown: snap.breakdown,
          });
        });
        continue;
      }

      // Legacy fallback when no frozen installment snapshots exist yet.
      const latestInstallmentCents = Math.max(
        0,
        primary.topupAmountCents ?? 0,
      );
      const priorPaidInstallmentCents =
        latestInstallmentCents > 0 && latestInstallmentCents < amountCents ?
          amountCents - latestInstallmentCents
        : 0;

      addOns.push({
        reconciliationId: primary.reconciliationId,
        reconciliationIds,
        amountCents,
        priorPaidInstallmentCents,
        topupNumber: formatMerchandiseTopupNumber(primary.reconciliationId),
        batchNumber,
        productName,
        productNames,
        topupCheckoutOrderId,
        topupPaidAt: primary.topupPaidAt,
        lines,
        breakdown: {
          checkoutMerchandiseCents: primary.checkoutMerchandiseCents,
          checkoutShippingCents: primary.checkoutShippingCents,
          checkoutTaxCents: primary.checkoutTaxCents,
          checkoutServiceCents: primary.checkoutServiceCents,
          actualMerchandiseCents: primary.actualMerchandiseCents,
          actualShippingCents: primary.actualShippingCents,
          actualTaxCents: primary.actualTaxCents,
          actualServiceCents: primary.actualServiceCents,
          deltaCents: primary.deltaCents,
        },
      });
    }

    return addOns;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return [];
    throw e;
  }
}

/**
 * Paid purchase-price top-up cents for order lines (batch siblings counted once).
 * Includes prior payments even when a later top-up is still pending.
 */
export async function sumPaidMerchandiseTopupAddOnCentsForOrderItems(params: {
  clerkUserId: string;
  orderItemIds: string[];
}): Promise<number> {
  const addOns = await listPaidMerchandiseTopupAddOnsForOrderItems(params);
  return addOns.reduce((sum, addOn) => sum + addOn.amountCents, 0);
}
