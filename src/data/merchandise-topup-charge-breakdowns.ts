import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { ensureMerchandiseReconciliationSchema } from "@/data/ensure-merchandise-reconciliation-schema";
import type { MerchandiseTopupChargeBreakdown } from "@/data/merchandise-topup-cart";
import { getDb } from "@/db";
import { merchandiseTopupChargeBreakdowns } from "@/db/schema";
import { isMissingMerchandiseReconciliationTableError } from "@/lib/db-column-missing";

export type MerchandiseTopupChargeBreakdownView = {
  id: string;
  groupKey: string;
  reconciliationId: string;
  amountCents: number;
  priorPaidNetCents: number;
  deltaCents: number;
  status: "pending" | "paid" | "revoked";
  topupPaymentId: string | null;
  topupExpiresAt: string | null;
  createdAt: string;
  breakdown: MerchandiseTopupChargeBreakdown;
};

function toView(
  row: typeof merchandiseTopupChargeBreakdowns.$inferSelect,
): MerchandiseTopupChargeBreakdownView {
  return {
    id: row.id,
    groupKey: row.groupKey,
    reconciliationId: row.reconciliationId,
    amountCents: Math.max(0, row.amountCents),
    priorPaidNetCents: Math.max(0, row.priorPaidNetCents),
    deltaCents: row.deltaCents,
    status: row.status,
    topupPaymentId: row.topupPaymentId,
    topupExpiresAt: row.topupExpiresAt,
    createdAt: row.createdAt,
    breakdown: {
      checkoutMerchandiseCents: row.checkoutMerchandiseCents,
      checkoutShippingCents: row.checkoutShippingCents,
      checkoutTaxCents: row.checkoutTaxCents,
      checkoutServiceCents: row.checkoutServiceCents,
      actualMerchandiseCents: row.actualMerchandiseCents,
      actualShippingCents: row.actualShippingCents,
      actualTaxCents: row.actualTaxCents,
      actualServiceCents: row.actualServiceCents,
      deltaCents: row.deltaCents,
    },
  };
}

export function merchandiseTopupBreakdownGroupKey(params: {
  supportTicketId?: string | null;
  reconciliationId: string;
}): string {
  const ticket = params.supportTicketId?.trim();
  return ticket || params.reconciliationId;
}

/**
 * Insert a new installment breakdown snapshot. Never updates prior rows.
 * Any existing pending snapshot for the same charge group is marked revoked.
 */
export async function insertMerchandiseTopupChargeBreakdown(params: {
  clerkUserId: string;
  groupKey: string;
  reconciliationId: string;
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  actualMerchandiseCents: number;
  actualShippingCents: number;
  actualTaxCents: number;
  actualServiceCents: number;
  deltaCents: number;
  amountCents: number;
  priorPaidNetCents: number;
  topupExpiresAt?: string | null;
  createdByClerkUserId: string;
}): Promise<MerchandiseTopupChargeBreakdownView> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const amountCents = Math.max(0, Math.round(params.amountCents));
  if (amountCents <= 0) {
    throw new Error("Top-up breakdown amount must be positive.");
  }

  await db
    .update(merchandiseTopupChargeBreakdowns)
    .set({ status: "revoked", updatedAt: now })
    .where(
      and(
        eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
        eq(merchandiseTopupChargeBreakdowns.groupKey, params.groupKey),
        eq(merchandiseTopupChargeBreakdowns.status, "pending"),
      ),
    );

  const [inserted] = await db
    .insert(merchandiseTopupChargeBreakdowns)
    .values({
      clerkUserId: params.clerkUserId,
      groupKey: params.groupKey,
      reconciliationId: params.reconciliationId,
      checkoutMerchandiseCents: Math.max(
        0,
        Math.round(params.checkoutMerchandiseCents),
      ),
      checkoutShippingCents: Math.max(
        0,
        Math.round(params.checkoutShippingCents),
      ),
      checkoutTaxCents: Math.max(0, Math.round(params.checkoutTaxCents)),
      checkoutServiceCents: Math.max(
        0,
        Math.round(params.checkoutServiceCents),
      ),
      actualMerchandiseCents: Math.max(
        0,
        Math.round(params.actualMerchandiseCents),
      ),
      actualShippingCents: Math.max(0, Math.round(params.actualShippingCents)),
      actualTaxCents: Math.max(0, Math.round(params.actualTaxCents)),
      actualServiceCents: Math.max(0, Math.round(params.actualServiceCents)),
      deltaCents: Math.round(params.deltaCents),
      amountCents,
      priorPaidNetCents: Math.max(0, Math.round(params.priorPaidNetCents)),
      status: "pending",
      topupExpiresAt: params.topupExpiresAt ?? null,
      createdByClerkUserId: params.createdByClerkUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Could not save top-up charge breakdown.");
  }
  return toView(inserted);
}

/** Mark open pending breakdowns for a charge group as revoked (e.g. admin revoke). */
export async function revokePendingMerchandiseTopupChargeBreakdowns(params: {
  clerkUserId: string;
  groupKey: string;
}): Promise<number> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  try {
    const updated = await db
      .update(merchandiseTopupChargeBreakdowns)
      .set({ status: "revoked", updatedAt: now })
      .where(
        and(
          eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
          eq(merchandiseTopupChargeBreakdowns.groupKey, params.groupKey),
          eq(merchandiseTopupChargeBreakdowns.status, "pending"),
        ),
      )
      .returning({ id: merchandiseTopupChargeBreakdowns.id });
    return updated.length;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return 0;
    throw e;
  }
}

/** Attach a Stripe payment to the open pending breakdown(s) for these reconciliations. */
export async function markMerchandiseTopupChargeBreakdownsPaid(params: {
  clerkUserId: string;
  reconciliationIds: string[];
  topupPaymentId: string;
  /** Used only when no pending snapshot exists (legacy / backfill). */
  amountCents?: number;
}): Promise<void> {
  if (params.reconciliationIds.length === 0) return;
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  try {
    const { orderItemMerchandiseReconciliations } = await import("@/db/schema");
    const reconMeta = await db
      .select()
      .from(orderItemMerchandiseReconciliations)
      .where(
        and(
          eq(
            orderItemMerchandiseReconciliations.clerkUserId,
            params.clerkUserId,
          ),
          inArray(
            orderItemMerchandiseReconciliations.id,
            params.reconciliationIds,
          ),
        ),
      );

    const groupKeys = Array.from(
      new Set(
        reconMeta.map((r) =>
          merchandiseTopupBreakdownGroupKey({
            supportTicketId: r.supportTicketId,
            reconciliationId: r.id,
          }),
        ),
      ),
    );
    if (groupKeys.length === 0) return;

    const updated = await db
      .update(merchandiseTopupChargeBreakdowns)
      .set({
        status: "paid",
        topupPaymentId: params.topupPaymentId,
        updatedAt: now,
      })
      .where(
        and(
          eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
          eq(merchandiseTopupChargeBreakdowns.status, "pending"),
          inArray(merchandiseTopupChargeBreakdowns.groupKey, groupKeys),
        ),
      )
      .returning({ id: merchandiseTopupChargeBreakdowns.id });

    if (updated.length > 0) return;

    // No pending snapshot (e.g. paid before snapshots existed) — freeze current sides.
    const primary = reconMeta[0]!;
    const amountCents = Math.max(
      0,
      Math.round(
        params.amountCents ??
          primary.topupAmountCents ??
          primary.deltaCents ??
          0,
      ),
    );
    if (amountCents <= 0) return;
    const groupKey = groupKeys[0]!;
    const createdByClerkUserId =
      primary.updatedByClerkUserId?.trim() ||
      primary.createdByClerkUserId?.trim() ||
      params.clerkUserId;
    await db.insert(merchandiseTopupChargeBreakdowns).values({
      clerkUserId: params.clerkUserId,
      groupKey,
      reconciliationId: primary.id,
      checkoutMerchandiseCents: primary.checkoutMerchandiseCents,
      checkoutShippingCents: primary.checkoutShippingCents,
      checkoutTaxCents: primary.checkoutTaxCents,
      checkoutServiceCents: primary.checkoutServiceCents,
      actualMerchandiseCents: primary.actualMerchandiseCents,
      actualShippingCents: primary.actualShippingCents,
      actualTaxCents: primary.actualTaxCents,
      actualServiceCents: primary.actualServiceCents,
      deltaCents: primary.deltaCents,
      amountCents,
      priorPaidNetCents: Math.max(
        0,
        (primary.topupPaidTotalCents ?? 0) -
          (primary.topupRefundedCents ?? 0) -
          amountCents,
      ),
      status: "paid",
      topupPaymentId: params.topupPaymentId,
      topupExpiresAt: primary.topupExpiresAt,
      createdByClerkUserId,
      createdAt: primary.topupPaidAt ?? now,
      updatedAt: now,
    });
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return;
    throw e;
  }
}

/**
 * If this charge group already has paid top-up(s) but no frozen rows yet,
 * insert one paid snapshot from the current reconciliation (legacy backfill).
 */
export async function ensureLegacyPaidTopupBreakdownIfMissing(params: {
  clerkUserId: string;
  reconciliation: {
    id: string;
    supportTicketId?: string | null;
    checkoutMerchandiseCents: number;
    checkoutShippingCents: number;
    checkoutTaxCents: number;
    checkoutServiceCents: number;
    actualMerchandiseCents: number;
    actualShippingCents: number;
    actualTaxCents: number;
    actualServiceCents: number;
    deltaCents: number;
    topupAmountCents?: number | null;
    topupPaidTotalCents?: number | null;
    topupRefundedCents?: number | null;
    topupPaidAt?: string | null;
    topupExpiresAt?: string | null;
    topupCheckoutOrderId?: string | null;
    updatedByClerkUserId?: string | null;
    createdByClerkUserId?: string | null;
  };
}): Promise<MerchandiseTopupChargeBreakdownView[]> {
  const groupKey = merchandiseTopupBreakdownGroupKey({
    supportTicketId: params.reconciliation.supportTicketId,
    reconciliationId: params.reconciliation.id,
  });
  const existing = await listMerchandiseTopupChargeBreakdownsForGroup({
    clerkUserId: params.clerkUserId,
    groupKey,
  });
  // Any frozen installment (pending or paid) means history already started.
  if (existing.some((b) => b.status === "paid" || b.status === "pending")) {
    return existing;
  }

  const paidNet = Math.max(
    0,
    (params.reconciliation.topupPaidTotalCents ?? 0) -
      (params.reconciliation.topupRefundedCents ?? 0),
  );
  if (paidNet <= 0) return existing;

  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const createdByClerkUserId =
    params.reconciliation.updatedByClerkUserId?.trim() ||
    params.reconciliation.createdByClerkUserId?.trim() ||
    params.clerkUserId;
  try {
    const [inserted] = await db
      .insert(merchandiseTopupChargeBreakdowns)
      .values({
        clerkUserId: params.clerkUserId,
        groupKey,
        reconciliationId: params.reconciliation.id,
        checkoutMerchandiseCents:
          params.reconciliation.checkoutMerchandiseCents,
        checkoutShippingCents: params.reconciliation.checkoutShippingCents,
        checkoutTaxCents: params.reconciliation.checkoutTaxCents,
        checkoutServiceCents: params.reconciliation.checkoutServiceCents,
        actualMerchandiseCents: params.reconciliation.actualMerchandiseCents,
        actualShippingCents: params.reconciliation.actualShippingCents,
        actualTaxCents: params.reconciliation.actualTaxCents,
        actualServiceCents: params.reconciliation.actualServiceCents,
        deltaCents: params.reconciliation.deltaCents,
        amountCents: paidNet,
        priorPaidNetCents: 0,
        status: "paid",
        topupExpiresAt: params.reconciliation.topupExpiresAt ?? null,
        createdByClerkUserId,
        createdAt: params.reconciliation.topupPaidAt ?? now,
        updatedAt: now,
      })
      .returning();
    if (!inserted) return existing;
    return [...existing.filter((b) => b.status !== "revoked"), toView(inserted)];
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return existing;
    // Never block the admin panel on legacy backfill failures.
    console.warn(
      "[Amani Cart2Barrel] ensureLegacyPaidTopupBreakdownIfMissing failed:",
      e,
    );
    return existing;
  }
}

export async function listMerchandiseTopupChargeBreakdownsForGroup(params: {
  clerkUserId: string;
  groupKey: string;
  /** Default: pending + paid (exclude revoked). */
  includeRevoked?: boolean;
}): Promise<MerchandiseTopupChargeBreakdownView[]> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(merchandiseTopupChargeBreakdowns)
      .where(
        and(
          eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
          eq(merchandiseTopupChargeBreakdowns.groupKey, params.groupKey),
        ),
      )
      .orderBy(asc(merchandiseTopupChargeBreakdowns.createdAt));

    return rows
      .filter((r) => params.includeRevoked || r.status !== "revoked")
      .map(toView);
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return [];
    throw e;
  }
}

export async function listPaidMerchandiseTopupChargeBreakdownsForReconciliations(params: {
  clerkUserId: string;
  reconciliationIds: string[];
}): Promise<MerchandiseTopupChargeBreakdownView[]> {
  if (params.reconciliationIds.length === 0) return [];
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(merchandiseTopupChargeBreakdowns)
      .where(
        and(
          eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
          eq(merchandiseTopupChargeBreakdowns.status, "paid"),
          inArray(
            merchandiseTopupChargeBreakdowns.reconciliationId,
            params.reconciliationIds,
          ),
        ),
      )
      .orderBy(asc(merchandiseTopupChargeBreakdowns.createdAt));

    // Dedupe by id (batch siblings may share one snapshot via group key lookup later).
    const seen = new Set<string>();
    const out: MerchandiseTopupChargeBreakdownView[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(toView(row));
    }
    return out;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return [];
    throw e;
  }
}

export async function getLatestPendingMerchandiseTopupChargeBreakdown(params: {
  clerkUserId: string;
  groupKey: string;
}): Promise<MerchandiseTopupChargeBreakdownView | null> {
  await ensureMerchandiseReconciliationSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(merchandiseTopupChargeBreakdowns)
      .where(
        and(
          eq(merchandiseTopupChargeBreakdowns.clerkUserId, params.clerkUserId),
          eq(merchandiseTopupChargeBreakdowns.groupKey, params.groupKey),
          eq(merchandiseTopupChargeBreakdowns.status, "pending"),
        ),
      )
      .orderBy(desc(merchandiseTopupChargeBreakdowns.createdAt))
      .limit(1);
    return row ? toView(row) : null;
  } catch (e) {
    if (isMissingMerchandiseReconciliationTableError(e)) return null;
    throw e;
  }
}
