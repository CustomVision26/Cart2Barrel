import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { itemQuotes, itemRequests, type ItemQuote } from "@/db/schema";
import {
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID,
  type ItemQuoteCheckoutSnapshotKind,
  isOperationalQuoteRow,
} from "@/lib/checkout-snapshot-kind";
import { isMissingMerchandiseSavingsColumnError, isUndefinedColumnError } from "@/lib/db-column-missing";
import { getNeonSql } from "@/lib/neon-sql";
import {
  ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT,
  type ItemQuoteVoidReason,
} from "@/lib/item-quote-void-reason";

/** All `item_quotes` columns except `checkout_snapshot_kind` (migration 0009). */
export const itemQuoteCoreSelect = {
  id: itemQuotes.id,
  itemRequestId: itemQuotes.itemRequestId,
  itemCost: itemQuotes.itemCost,
  merchandiseSavingsCents: itemQuotes.merchandiseSavingsCents,
  serviceFee: itemQuotes.serviceFee,
  estimatedShipping: itemQuotes.estimatedShipping,
  totalPrice: itemQuotes.totalPrice,
  voidedAt: itemQuotes.voidedAt,
  voidReason: itemQuotes.voidReason,
  requestQuantity: itemQuotes.requestQuantity,
  requestProductSize: itemQuotes.requestProductSize,
  requestProductColor: itemQuotes.requestProductColor,
  requestProductName: itemQuotes.requestProductName,
  merchandiseIncludesSiteShippingTax: itemQuotes.merchandiseIncludesSiteShippingTax,
  createdAt: itemQuotes.createdAt,
} as const;

/**
 * Same shapes as {@link itemQuoteCoreSelect} but without `merchandise_savings_cents`
 * for databases that have not applied that migration yet.
 */
export const itemQuoteCoreSelectPreMerchandiseSavings = {
  id: itemQuotes.id,
  itemRequestId: itemQuotes.itemRequestId,
  itemCost: itemQuotes.itemCost,
  serviceFee: itemQuotes.serviceFee,
  estimatedShipping: itemQuotes.estimatedShipping,
  totalPrice: itemQuotes.totalPrice,
  voidedAt: itemQuotes.voidedAt,
  voidReason: itemQuotes.voidReason,
  requestQuantity: itemQuotes.requestQuantity,
  requestProductSize: itemQuotes.requestProductSize,
  requestProductColor: itemQuotes.requestProductColor,
  requestProductName: itemQuotes.requestProductName,
  createdAt: itemQuotes.createdAt,
} as const;

/**
 * SQL counterpart of `isOperationalQuoteRow`: blanks / whitespace, non-timeline values,
 * and explicit exclusion of checkout timeline kinds (`paid`, `company_purchase`).
 */
function operationalCheckoutSnapshotWhere() {
  return sql`(
    trim(both from coalesce(${itemQuotes.checkoutSnapshotKind}, '')) = ''
    OR (
      ${itemQuotes.checkoutSnapshotKind} IS DISTINCT FROM ${ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID}
      AND ${itemQuotes.checkoutSnapshotKind} IS DISTINCT FROM ${ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE}
      AND trim(both from coalesce(${itemQuotes.checkoutSnapshotKind}, '')) <> ''
    )
  )`;
}

export type ItemQuoteInsertRow = {
  itemCost: number;
  /**
   * Listed pack/bundle savings before net merchandise (`itemCost`); omit or null if none.
   */
  merchandiseSavingsCents?: number | null;
  serviceFee: number;
  estimatedShipping: number;
  totalPrice: number;
  requestQuantity: number;
  requestProductSize: string | null;
  requestProductColor: string | null;
  requestProductName: string | null;
  /** Retailer-listed shipping/tax bundled into merchandise; line splits stay $0. */
  merchandiseIncludesSiteShippingTax?: boolean;
};

export function itemRequestSnapshotForQuote(req: {
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  productName: string | null;
}): Pick<
  ItemQuoteInsertRow,
  | "requestQuantity"
  | "requestProductSize"
  | "requestProductColor"
  | "requestProductName"
> {
  return {
    requestQuantity: req.quantity,
    requestProductSize: req.productSize?.trim() || null,
    requestProductColor: req.productColor?.trim() || null,
    requestProductName: req.productName?.trim() || null,
  };
}

function rowRecordToItemQuote(
  r: Record<string, unknown>,
  checkoutSnapshotKind: string | null
): ItemQuote {
  return {
    id: String(r.id),
    itemRequestId: String(r.item_request_id),
    itemCost: Number(r.item_cost),
    serviceFee: Number(r.service_fee),
    estimatedShipping: Number(r.estimated_shipping),
    totalPrice: Number(r.total_price),
    voidedAt: r.voided_at != null ? String(r.voided_at) : null,
    voidReason: r.void_reason != null ? String(r.void_reason) : null,
    requestQuantity:
      r.request_quantity != null ? Number(r.request_quantity) : null,
    requestProductSize:
      r.request_product_size != null ? String(r.request_product_size) : null,
    requestProductColor:
      r.request_product_color != null ? String(r.request_product_color) : null,
    requestProductName:
      r.request_product_name != null ? String(r.request_product_name) : null,
    merchandiseSavingsCents:
      r.merchandise_savings_cents != null &&
      r.merchandise_savings_cents !== ""
        ? Number(r.merchandise_savings_cents)
        : null,
    merchandiseIncludesSiteShippingTax: Boolean(
      r.merchandise_includes_site_shipping_tax,
    ),
    checkoutSnapshotKind,
    createdAt: String(r.created_at),
  };
}

/** INSERT without `checkout_snapshot_kind` when that migration column is missing. */
async function insertItemQuoteNarrowSql(values: {
  itemRequestId: string;
  itemCost: number;
  merchandiseSavingsCents: number | null;
  serviceFee: number;
  estimatedShipping: number;
  totalPrice: number;
  merchandiseIncludesSiteShippingTax: boolean;
  requestQuantity: number | null;
  requestProductSize: string | null;
  requestProductColor: string | null;
  requestProductName: string | null;
}): Promise<ItemQuote> {
  const sql = getNeonSql();
  const rows = await sql`
    INSERT INTO item_quotes (
      item_request_id,
      item_cost,
      merchandise_savings_cents,
      service_fee,
      estimated_shipping,
      total_price,
      merchandise_includes_site_shipping_tax,
      request_quantity,
      request_product_size,
      request_product_color,
      request_product_name
    ) VALUES (
      ${values.itemRequestId}::uuid,
      ${values.itemCost},
      ${values.merchandiseSavingsCents},
      ${values.serviceFee},
      ${values.estimatedShipping},
      ${values.totalPrice},
      ${values.merchandiseIncludesSiteShippingTax},
      ${values.requestQuantity},
      ${values.requestProductSize},
      ${values.requestProductColor},
      ${values.requestProductName}
    )
    RETURNING
      id,
      item_request_id,
      item_cost,
      merchandise_savings_cents,
      service_fee,
      estimated_shipping,
      total_price,
      voided_at,
      void_reason,
      merchandise_includes_site_shipping_tax,
      request_quantity,
      request_product_size,
      request_product_color,
      request_product_name,
      created_at
  `;
  const rowList = rows as unknown as Record<string, unknown>[];
  const r = rowList[0];
  if (!r) {
    throw new Error("Failed to insert item quote.");
  }
  return rowRecordToItemQuote(r, null);
}

export async function insertCheckoutTimelineQuote(params: {
  itemRequestId: string;
  sourceQuote: ItemQuote;
  checkoutSnapshotKind: ItemQuoteCheckoutSnapshotKind;
}): Promise<ItemQuote> {
  const src = params.sourceQuote;
  const db = getDb();
  try {
    const [created] = await db
      .insert(itemQuotes)
      .values({
        itemRequestId: params.itemRequestId,
        itemCost: src.itemCost,
        merchandiseSavingsCents: src.merchandiseSavingsCents ?? null,
        serviceFee: src.serviceFee,
        estimatedShipping: src.estimatedShipping,
        totalPrice: src.totalPrice,
        merchandiseIncludesSiteShippingTax: src.merchandiseIncludesSiteShippingTax,
        requestQuantity: src.requestQuantity,
        requestProductSize: src.requestProductSize,
        requestProductColor: src.requestProductColor,
        requestProductName: src.requestProductName,
        checkoutSnapshotKind: params.checkoutSnapshotKind,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to insert checkout timeline quote.");
    }
    return created;
  } catch (e) {
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    const inserted = await insertItemQuoteNarrowSql({
      itemRequestId: params.itemRequestId,
      itemCost: src.itemCost,
      merchandiseSavingsCents: src.merchandiseSavingsCents ?? null,
      serviceFee: src.serviceFee,
      estimatedShipping: src.estimatedShipping,
      totalPrice: src.totalPrice,
      merchandiseIncludesSiteShippingTax: src.merchandiseIncludesSiteShippingTax,
      requestQuantity: src.requestQuantity,
      requestProductSize: src.requestProductSize,
      requestProductColor: src.requestProductColor,
      requestProductName: src.requestProductName,
    });
    return {
      ...inserted,
      checkoutSnapshotKind: params.checkoutSnapshotKind,
    };
  }
}

export async function insertItemQuoteForRequest(
  itemRequestId: string,
  row: ItemQuoteInsertRow
): Promise<ItemQuote> {
  const db = getDb();
  try {
    const [created] = await db
      .insert(itemQuotes)
      .values({
        itemRequestId,
        itemCost: row.itemCost,
        merchandiseSavingsCents: row.merchandiseSavingsCents ?? null,
        serviceFee: row.serviceFee,
        estimatedShipping: row.estimatedShipping,
        totalPrice: row.totalPrice,
        merchandiseIncludesSiteShippingTax: row.merchandiseIncludesSiteShippingTax ?? false,
        requestQuantity: row.requestQuantity,
        requestProductSize: row.requestProductSize,
        requestProductColor: row.requestProductColor,
        requestProductName: row.requestProductName,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to insert item quote.");
    }
    return created;
  } catch (e) {
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    return insertItemQuoteNarrowSql({
      itemRequestId,
      itemCost: row.itemCost,
      merchandiseSavingsCents: row.merchandiseSavingsCents ?? null,
      serviceFee: row.serviceFee,
      estimatedShipping: row.estimatedShipping,
      totalPrice: row.totalPrice,
      merchandiseIncludesSiteShippingTax: row.merchandiseIncludesSiteShippingTax ?? false,
      requestQuantity: row.requestQuantity,
      requestProductSize: row.requestProductSize,
      requestProductColor: row.requestProductColor,
      requestProductName: row.requestProductName,
    });
  }
}

export async function updateItemRequestAfterQuote(
  itemRequestId: string,
  patch: {
    productColor: string | null;
    productSize: string | null;
    productImageUrl?: string | null;
  }
): Promise<void> {
  const db = getDb();
  await db
    .update(itemRequests)
    .set({
      productColor: patch.productColor,
      productSize: patch.productSize,
      ...(patch.productImageUrl !== undefined
        ? { productImageUrl: patch.productImageUrl }
        : {}),
      status: "quoted",
    })
    .where(eq(itemRequests.id, itemRequestId));
}

/** Mark active (non-voided) quote rows for this request as superseded. */
export async function voidActiveQuotesForItemRequest(
  itemRequestId: string,
  reason: ItemQuoteVoidReason
): Promise<void> {
  const db = getDb();
  const ts = new Date().toISOString();
  try {
    await db
      .update(itemQuotes)
      .set({ voidedAt: ts, voidReason: reason })
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNull(itemQuotes.voidedAt),
          operationalCheckoutSnapshotWhere()
        )
      );
  } catch (e) {
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    await db
      .update(itemQuotes)
      .set({ voidedAt: ts, voidReason: reason })
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNull(itemQuotes.voidedAt)
        )
      );
  }
}

/**
 * Repairs a broken state where staff voided quotes for a replacement save but the new row
 * never inserted: `item_requests.status` is `quoted` but every operational quote is voided.
 * Restores the newest voided `staff_replacement` operational row so accept/preview work again.
 */
export async function restoreOrphanQuotedItemRequestQuote(
  itemRequestId: string
): Promise<ItemQuote | undefined> {
  const db = getDb();
  try {
    const active = await db
      .select()
      .from(itemQuotes)
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNull(itemQuotes.voidedAt)
        )
      )
      .orderBy(desc(itemQuotes.createdAt))
      .limit(50);

    if (active.some((q) => isOperationalQuoteRow(q))) {
      return undefined;
    }

    const voided = await db
      .select()
      .from(itemQuotes)
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNotNull(itemQuotes.voidedAt)
        )
      )
      .orderBy(desc(itemQuotes.createdAt))
      .limit(50);

    const pick = voided.find(
      (q) =>
        q.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT &&
        isOperationalQuoteRow(q)
    );
    if (!pick) {
      return undefined;
    }

    await db
      .update(itemQuotes)
      .set({ voidedAt: null, voidReason: null })
      .where(eq(itemQuotes.id, pick.id));

    return {
      ...pick,
      voidedAt: null,
      voidReason: null,
    };
  } catch (e) {
    if (isMissingMerchandiseSavingsColumnError(e)) {
      const activeRows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      if (
        activeRows.some((r) =>
          isOperationalQuoteRow({
            ...r,
            checkoutSnapshotKind: null,
            merchandiseSavingsCents: null,
            merchandiseIncludesSiteShippingTax: false,
          } as ItemQuote)
        )
      ) {
        return undefined;
      }

      const voidedRows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNotNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      const pick = voidedRows.find(
        (r) => r.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT
      );
      if (!pick) {
        return undefined;
      }

      await db
        .update(itemQuotes)
        .set({ voidedAt: null, voidReason: null })
        .where(eq(itemQuotes.id, pick.id));

      return {
        ...pick,
        voidedAt: null,
        voidReason: null,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }

    try {
      const activeRows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      if (
        activeRows.some((r) =>
          isOperationalQuoteRow({
            ...r,
            checkoutSnapshotKind: null,
          } as ItemQuote)
        )
      ) {
        return undefined;
      }

      const voidedRows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNotNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      const pick = voidedRows.find(
        (r) => r.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT
      );
      if (!pick) {
        return undefined;
      }

      await db
        .update(itemQuotes)
        .set({ voidedAt: null, voidReason: null })
        .where(eq(itemQuotes.id, pick.id));

      return {
        ...pick,
        voidedAt: null,
        voidReason: null,
        checkoutSnapshotKind: null,
      };
    } catch (e2) {
      if (!isMissingMerchandiseSavingsColumnError(e2)) {
        throw e2;
      }

      const activeRows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      if (
        activeRows.some((r) =>
          isOperationalQuoteRow({
            ...r,
            checkoutSnapshotKind: null,
            merchandiseSavingsCents: null,
            merchandiseIncludesSiteShippingTax: false,
          } as ItemQuote)
        )
      ) {
        return undefined;
      }

      const voidedRows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNotNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(50);

      const pick = voidedRows.find(
        (r) => r.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT
      );
      if (!pick) {
        return undefined;
      }

      await db
        .update(itemQuotes)
        .set({ voidedAt: null, voidReason: null })
        .where(eq(itemQuotes.id, pick.id));

      return {
        ...pick,
        voidedAt: null,
        voidReason: null,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
  }
}

/** Latest non-voided quote for an item request, if any. */
export async function getLatestQuoteForItemRequest(
  itemRequestId: string
): Promise<ItemQuote | undefined> {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(itemQuotes)
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNull(itemQuotes.voidedAt),
          operationalCheckoutSnapshotWhere()
        )
      )
      .orderBy(desc(itemQuotes.createdAt))
      .limit(1);
    if (rows[0]) {
      return rows[0];
    }

    const candidates = await db
      .select()
      .from(itemQuotes)
      .where(
        and(
          eq(itemQuotes.itemRequestId, itemRequestId),
          isNull(itemQuotes.voidedAt)
        )
      )
      .orderBy(desc(itemQuotes.createdAt))
      .limit(100);
    for (const q of candidates) {
      if (isOperationalQuoteRow(q)) {
        return q;
      }
    }
    return undefined;
  } catch (e) {
    if (isMissingMerchandiseSavingsColumnError(e)) {
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    try {
      const rows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return { ...row, checkoutSnapshotKind: null };
    } catch (e2) {
      if (!isMissingMerchandiseSavingsColumnError(e2)) {
        throw e2;
      }
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(
          and(
            eq(itemQuotes.itemRequestId, itemRequestId),
            isNull(itemQuotes.voidedAt)
          )
        )
        .orderBy(desc(itemQuotes.createdAt))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
  }
}

export async function getItemQuoteById(
  quoteId: string
): Promise<ItemQuote | undefined> {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(itemQuotes)
      .where(eq(itemQuotes.id, quoteId))
      .limit(1);
    return rows[0];
  } catch (e) {
    if (isMissingMerchandiseSavingsColumnError(e)) {
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(eq(itemQuotes.id, quoteId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    try {
      const rows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .where(eq(itemQuotes.id, quoteId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return { ...row, checkoutSnapshotKind: null };
    } catch (e2) {
      if (!isMissingMerchandiseSavingsColumnError(e2)) {
        throw e2;
      }
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .where(eq(itemQuotes.id, quoteId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      };
    }
  }
}

/** Operational quote `item_cost` by request id (parallel lookups; OK for ~page-sized batches). */
export async function mapLatestOperationalQuoteItemCostByRequestIds(
  itemRequestIds: string[],
): Promise<Map<string, number | null>> {
  const unique = [...new Set(itemRequestIds)];
  const map = new Map<string, number | null>();
  await Promise.all(
    unique.map(async (id) => {
      const q = await getLatestQuoteForItemRequest(id);
      map.set(id, q?.itemCost ?? null);
    }),
  );
  return map;
}

/** All quote rows for owner-visible product history, grouped by request id by the caller. */
export async function listItemQuotesForOwnerByRequestIds(
  clerkUserId: string,
  itemRequestIds: string[],
): Promise<ItemQuote[]> {
  const unique = [...new Set(itemRequestIds)];
  if (unique.length === 0) return [];

  const db = getDb();
  try {
    const rows = await db
      .select({ quote: itemQuotes })
      .from(itemQuotes)
      .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemQuotes.itemRequestId, unique),
        ),
      )
      .orderBy(desc(itemQuotes.createdAt));
    return rows.map((r) => r.quote);
  } catch (e) {
    if (isMissingMerchandiseSavingsColumnError(e)) {
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemQuotes.itemRequestId, unique),
          ),
        )
        .orderBy(desc(itemQuotes.createdAt));
      return rows.map((row) => ({
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      }));
    }
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    try {
      const rows = await db
        .select(itemQuoteCoreSelect)
        .from(itemQuotes)
        .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemQuotes.itemRequestId, unique),
          ),
        )
        .orderBy(desc(itemQuotes.createdAt));
      return rows.map((row) => ({ ...row, checkoutSnapshotKind: null }));
    } catch (e2) {
      if (!isMissingMerchandiseSavingsColumnError(e2)) {
        throw e2;
      }
      const rows = await db
        .select(itemQuoteCoreSelectPreMerchandiseSavings)
        .from(itemQuotes)
        .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemQuotes.itemRequestId, unique),
          ),
        )
        .orderBy(desc(itemQuotes.createdAt));
      return rows.map((row) => ({
        ...row,
        merchandiseSavingsCents: null,
        merchandiseIncludesSiteShippingTax: false,
        checkoutSnapshotKind: null,
      }));
    }
  }
}

/** Update display fields only (does not change item request workflow status). */
export async function patchItemRequestDisplayFieldsOnly(
  itemRequestId: string,
  patch: {
    productName: string | null;
    productColor: string | null;
    productSize: string | null;
    productImageUrl?: string | null;
    quantity?: number;
  }
): Promise<void> {
  const db = getDb();
  await db
    .update(itemRequests)
    .set({
      productName: patch.productName,
      productColor: patch.productColor,
      productSize: patch.productSize,
      ...(patch.productImageUrl !== undefined
        ? { productImageUrl: patch.productImageUrl }
        : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    })
    .where(eq(itemRequests.id, itemRequestId));
}
