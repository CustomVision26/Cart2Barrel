import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, type ItemRequest } from "@/db/schema";
import {
  isMissingBatchQuoteSessionIdColumnError,
  isMissingItemRequestOutOfStockStatusError,
  isMissingOutsidePurchasePublishedAtColumnError,
  isMissingOutsidePurchaseReceiptImageUrlColumnError,
} from "@/lib/db-column-missing";
import { isOutsidePurchasePublishedToCustomer } from "@/lib/outside-purchase-published";
import { repairOutsidePurchaseActiveVisibility } from "@/data/outside-purchase-customer-visibility";
import { hostnameFromProductUrl } from "@/lib/site-name";

/**
 * `item_requests` columns when `batch_quote_session_id` is not migrated yet.
 * Keep in sync with schema (excluding the batch FK only).
 */
/** All `item_requests` columns except `batch_quote_session_id`. */
export const itemRequestsRowLegacySelect = {
  id: itemRequests.id,
  clerkUserId: itemRequests.clerkUserId,
  productUrl: itemRequests.productUrl,
  productName: itemRequests.productName,
  productSize: itemRequests.productSize,
  productColor: itemRequests.productColor,
  quantity: itemRequests.quantity,
  note: itemRequests.note,
  productImageUrl: itemRequests.productImageUrl,
  siteName: itemRequests.siteName,
  status: itemRequests.status,
  source: itemRequests.source,
  outsidePurchaseReference: itemRequests.outsidePurchaseReference,
  outsidePurchasePaymentPromptedAt: itemRequests.outsidePurchasePaymentPromptedAt,
  outsidePurchaseReceiptImageUrl: itemRequests.outsidePurchaseReceiptImageUrl,
  outsidePurchaseConditionImageUrl: itemRequests.outsidePurchaseConditionImageUrl,
  outsidePurchaseConditionImageUrls: itemRequests.outsidePurchaseConditionImageUrls,
  outsidePurchaseReceivedCondition: itemRequests.outsidePurchaseReceivedCondition,
  outsidePurchaseMissingReason: itemRequests.outsidePurchaseMissingReason,
  outsidePurchaseMissingResolvedAt: itemRequests.outsidePurchaseMissingResolvedAt,
  outsidePurchaseShelfLocation: itemRequests.outsidePurchaseShelfLocation,
  createdAt: itemRequests.createdAt,
} as const;

/** Legacy select when `outside_purchase_receipt_image_url` is not migrated yet. */
export const itemRequestsRowLegacySelectWithoutReceiptImage = {
  id: itemRequests.id,
  clerkUserId: itemRequests.clerkUserId,
  productUrl: itemRequests.productUrl,
  productName: itemRequests.productName,
  productSize: itemRequests.productSize,
  productColor: itemRequests.productColor,
  quantity: itemRequests.quantity,
  note: itemRequests.note,
  productImageUrl: itemRequests.productImageUrl,
  siteName: itemRequests.siteName,
  status: itemRequests.status,
  source: itemRequests.source,
  outsidePurchaseReference: itemRequests.outsidePurchaseReference,
  outsidePurchasePaymentPromptedAt: itemRequests.outsidePurchasePaymentPromptedAt,
  createdAt: itemRequests.createdAt,
} as const;

/** Full row select when only the receipt-image column is missing. */
export const itemRequestsRowSelectWithoutReceiptImage = {
  ...itemRequestsRowLegacySelectWithoutReceiptImage,
  batchQuoteSessionId: itemRequests.batchQuoteSessionId,
} as const;

type ItemRequestLegacyRow = Omit<
  ItemRequest,
  | "batchQuoteSessionId"
  | "outsidePurchasePublishedAt"
  | "outOfStockStaffNote"
  | "outOfStockAttachmentImageUrls"
> & {
  outsidePurchasePublishedAt?: ItemRequest["outsidePurchasePublishedAt"];
  outOfStockStaffNote?: ItemRequest["outOfStockStaffNote"];
  outOfStockAttachmentImageUrls?: ItemRequest["outOfStockAttachmentImageUrls"];
};
type OutsidePurchaseIntakeOptionalColumns =
  | "outsidePurchaseReceiptImageUrl"
  | "outsidePurchaseConditionImageUrl"
  | "outsidePurchaseConditionImageUrls"
  | "outsidePurchaseReceivedCondition"
  | "outsidePurchaseMissingReason"
  | "outsidePurchaseMissingResolvedAt"
  | "outsidePurchaseShelfLocation"
  | "outsidePurchasePublishedAt";
type ItemRequestLegacyRowWithoutReceipt = Omit<
  ItemRequestLegacyRow,
  OutsidePurchaseIntakeOptionalColumns
>;

export function withLegacyItemRequestDefaults(
  row: ItemRequestLegacyRow | ItemRequestLegacyRowWithoutReceipt,
): ItemRequest {
  return {
    ...row,
    batchQuoteSessionId: null,
    outsidePurchaseReceiptImageUrl:
      "outsidePurchaseReceiptImageUrl" in row ?
        (row.outsidePurchaseReceiptImageUrl ?? null)
      : null,
    outsidePurchaseConditionImageUrl:
      "outsidePurchaseConditionImageUrl" in row ?
        (row.outsidePurchaseConditionImageUrl ?? null)
      : null,
    outsidePurchaseConditionImageUrls:
      "outsidePurchaseConditionImageUrls" in row ?
        (row.outsidePurchaseConditionImageUrls ?? null)
      : null,
    outsidePurchaseReceivedCondition:
      "outsidePurchaseReceivedCondition" in row ?
        (row.outsidePurchaseReceivedCondition ?? null)
      : null,
    outsidePurchaseMissingReason:
      "outsidePurchaseMissingReason" in row ?
        (row.outsidePurchaseMissingReason ?? null)
      : null,
    outsidePurchaseMissingResolvedAt:
      "outsidePurchaseMissingResolvedAt" in row ?
        (row.outsidePurchaseMissingResolvedAt ?? null)
      : null,
    outsidePurchaseShelfLocation:
      "outsidePurchaseShelfLocation" in row ?
        (row.outsidePurchaseShelfLocation ?? null)
      : null,
    outsidePurchasePublishedAt:
      "outsidePurchasePublishedAt" in row ?
        (row.outsidePurchasePublishedAt ?? null)
      : "createdAt" in row ?
        row.createdAt
      : null,
    outOfStockStaffNote:
      "outOfStockStaffNote" in row ? (row.outOfStockStaffNote ?? null) : null,
    outOfStockAttachmentImageUrls:
      "outOfStockAttachmentImageUrls" in row ?
        (row.outOfStockAttachmentImageUrls ?? null)
      : null,
  };
}

export function itemRequestFromRowWithoutReceiptImage(
  row: Omit<
    ItemRequest,
    OutsidePurchaseIntakeOptionalColumns | "outOfStockStaffNote" | "outOfStockAttachmentImageUrls"
  > & {
    batchQuoteSessionId?: string | null;
    outOfStockStaffNote?: ItemRequest["outOfStockStaffNote"];
    outOfStockAttachmentImageUrls?: ItemRequest["outOfStockAttachmentImageUrls"];
  },
): ItemRequest {
  return {
    ...row,
    batchQuoteSessionId: row.batchQuoteSessionId ?? null,
    outsidePurchaseReceiptImageUrl: null,
    outsidePurchaseConditionImageUrl: null,
    outsidePurchaseConditionImageUrls: null,
    outsidePurchaseReceivedCondition: null,
    outsidePurchaseMissingReason: null,
    outsidePurchaseMissingResolvedAt: null,
    outsidePurchaseShelfLocation: null,
    outsidePurchasePublishedAt: row.createdAt,
    outOfStockStaffNote: row.outOfStockStaffNote ?? null,
    outOfStockAttachmentImageUrls: row.outOfStockAttachmentImageUrls ?? null,
  };
}

export function isMissingItemRequestReceiptImageColumnError(
  e: unknown,
): boolean {
  return isMissingOutsidePurchaseReceiptImageUrlColumnError(e);
}

const ACTIVE_REQUEST_STATUSES = ["pending", "quoted", "out_of_stock"] as const satisfies Readonly<
  ItemRequest["status"][]
>;

const ACTIVE_REQUEST_STATUSES_LEGACY = ["pending", "quoted"] as const satisfies Readonly<
  ItemRequest["status"][]
>;

/** Accepted (still in cart), withdrawn, or rejected — full archive for Add item → Product history. */
const PRODUCT_HISTORY_STATUSES = ["approved", "withdrawn", "rejected"] as const satisfies Readonly<
  ItemRequest["status"][]
>;

export async function getItemRequestById(
  id: string
): Promise<ItemRequest | undefined> {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(itemRequests)
      .where(eq(itemRequests.id, id))
      .limit(1);
    return rows[0];
  } catch (e) {
    if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      const rows = await db
        .select(itemRequestsRowSelectWithoutReceiptImage)
        .from(itemRequests)
        .where(eq(itemRequests.id, id))
        .limit(1);
      const row = rows[0];
      return row ? itemRequestFromRowWithoutReceiptImage(row) : undefined;
    }
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(eq(itemRequests.id, id))
        .limit(1);
      const row = rows[0];
      return row ? withLegacyItemRequestDefaults(row) : undefined;
    } catch (legacyErr) {
      if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(legacyErr)) {
        throw legacyErr;
      }
      const rows = await db
        .select(itemRequestsRowLegacySelectWithoutReceiptImage)
        .from(itemRequests)
        .where(eq(itemRequests.id, id))
        .limit(1);
      const row = rows[0];
      return row ? withLegacyItemRequestDefaults(row) : undefined;
    }
  }
}

async function listActiveItemRequestsForUserQuery(
  clerkUserId: string,
  statuses: readonly ItemRequest["status"][],
  legacySelect: boolean
): Promise<ItemRequest[]> {
  const db = getDb();
  if (legacySelect) {
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...statuses])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return filterCustomerVisibleActiveRequests(
        await prepareCustomerActiveItemRequests(
          clerkUserId,
          rows.map(withLegacyItemRequestDefaults),
        ),
      );
    } catch (e) {
      if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) throw e;
      const rows = await db
        .select(itemRequestsRowLegacySelectWithoutReceiptImage)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...statuses])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return filterCustomerVisibleActiveRequests(
        await prepareCustomerActiveItemRequests(
          clerkUserId,
          rows.map(withLegacyItemRequestDefaults),
        ),
      );
    }
  }
  const rows = await db
    .select()
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        inArray(itemRequests.status, [...statuses])
      )
    )
    .orderBy(desc(itemRequests.createdAt));
  return filterCustomerVisibleActiveRequests(
    await prepareCustomerActiveItemRequests(clerkUserId, rows),
  );
}

function filterCustomerVisibleActiveRequests(rows: ItemRequest[]): ItemRequest[] {
  return rows.filter(isOutsidePurchasePublishedToCustomer);
}

async function prepareCustomerActiveItemRequests(
  clerkUserId: string,
  rows: ItemRequest[],
): Promise<ItemRequest[]> {
  return repairOutsidePurchaseActiveVisibility(clerkUserId, rows);
}

/** In-flight requests (not in cart, not closed). Includes rows attached to a batch quote
 *  (`batch_quote_session_id`) so the Products tab can show them as inactive alongside
 *  unbatched lines. Approved items live in cart only. */
export async function listActiveItemRequestsForUser(
  clerkUserId: string
): Promise<ItemRequest[]> {
  try {
    return await listActiveItemRequestsForUserQuery(
      clerkUserId,
      ACTIVE_REQUEST_STATUSES,
      false
    );
  } catch (e) {
    if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      const db = getDb();
      const rows = await db
        .select(itemRequestsRowSelectWithoutReceiptImage)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...ACTIVE_REQUEST_STATUSES])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return filterCustomerVisibleActiveRequests(
        await prepareCustomerActiveItemRequests(
          clerkUserId,
          rows.map(itemRequestFromRowWithoutReceiptImage),
        ),
      );
    }
    if (isMissingOutsidePurchasePublishedAtColumnError(e)) {
      return listActiveItemRequestsForUserQuery(
        clerkUserId,
        ACTIVE_REQUEST_STATUSES,
        true,
      );
    }
    if (isMissingItemRequestOutOfStockStatusError(e)) {
      try {
        return await listActiveItemRequestsForUserQuery(
          clerkUserId,
          ACTIVE_REQUEST_STATUSES_LEGACY,
          false
        );
      } catch (legacyEnumErr) {
        if (!isMissingBatchQuoteSessionIdColumnError(legacyEnumErr)) {
          throw legacyEnumErr;
        }
        return listActiveItemRequestsForUserQuery(
          clerkUserId,
          ACTIVE_REQUEST_STATUSES_LEGACY,
          true
        );
      }
    }
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      return await listActiveItemRequestsForUserQuery(
        clerkUserId,
        ACTIVE_REQUEST_STATUSES,
        true
      );
    } catch (legacyBatchErr) {
      if (!isMissingItemRequestOutOfStockStatusError(legacyBatchErr)) {
        throw legacyBatchErr;
      }
      return listActiveItemRequestsForUserQuery(
        clerkUserId,
        ACTIVE_REQUEST_STATUSES_LEGACY,
        true
      );
    }
  }
}

/** Approved (in cart), removed-from-cart, and rejected records. */
export async function listProductHistoryForUser(
  clerkUserId: string
): Promise<ItemRequest[]> {
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemRequests.status, [...PRODUCT_HISTORY_STATUSES])
        )
      )
      .orderBy(desc(itemRequests.createdAt));
  } catch (e) {
    if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      const rows = await db
        .select(itemRequestsRowSelectWithoutReceiptImage)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...PRODUCT_HISTORY_STATUSES])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return rows.map(itemRequestFromRowWithoutReceiptImage);
    }
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...PRODUCT_HISTORY_STATUSES])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return rows.map(withLegacyItemRequestDefaults);
    } catch (legacyErr) {
      if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(legacyErr)) {
        throw legacyErr;
      }
      const rows = await db
        .select(itemRequestsRowLegacySelectWithoutReceiptImage)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.status, [...PRODUCT_HISTORY_STATUSES])
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return rows.map(withLegacyItemRequestDefaults);
    }
  }
}

const CUSTOMER_EDITABLE_STATUSES = ["pending", "quoted"] as const satisfies Readonly<
  ItemRequest["status"][]
>;

/** Update quantity / size / color for the owner while request is pending or quoted. */
export async function updateItemRequestLineDetailsForOwner(
  id: string,
  clerkUserId: string,
  patch: {
    quantity: number;
    productSize: string | null;
    productColor: string | null;
  }
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(itemRequests)
    .set({
      quantity: patch.quantity,
      productSize: patch.productSize,
      productColor: patch.productColor,
    })
    .where(
      and(
        eq(itemRequests.id, id),
        eq(itemRequests.clerkUserId, clerkUserId),
        inArray(itemRequests.status, [...CUSTOMER_EDITABLE_STATUSES])
      )
    )
    .returning({ id: itemRequests.id });
  return updated.length > 0;
}

/**
 * Owner asked for a fresh quote: save line details and set status to pending. Only from `quoted`.
 * Caller should delete `item_quotes` rows after this succeeds.
 */
export async function resetQuotedRequestToPendingForRework(
  id: string,
  clerkUserId: string,
  patch: {
    quantity: number;
    productSize: string | null;
    productColor: string | null;
  }
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(itemRequests)
    .set({
      quantity: patch.quantity,
      productSize: patch.productSize,
      productColor: patch.productColor,
      status: "pending",
    })
    .where(
      and(
        eq(itemRequests.id, id),
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "quoted")
      )
    )
    .returning({ id: itemRequests.id });
  return updated.length > 0;
}

/**
 * After admin AI extraction: persist HTTPS image URL on the request for cart/UI.
 * Fills `product_name` only when the shopper left it empty.
 * Sets `site_name` from extraction or hostname of the product URL.
 */
export async function applyAiExtractionPatchToItemRequest(
  itemRequestId: string,
  extraction: {
    productImageUrl: string | null;
    productName: string | null;
    siteName?: string | null;
  }
): Promise<void> {
  const existing = await getItemRequestById(itemRequestId);
  if (!existing) return;

  const patch: {
    productImageUrl?: string | null;
    productName?: string | null;
    siteName?: string | null;
  } = {};

  const img = extraction.productImageUrl?.trim();
  if (img) {
    patch.productImageUrl = img;
  }

  const title = extraction.productName?.trim();
  if (title && !existing.productName?.trim()) {
    patch.productName = title;
  }

  const site =
    extraction.siteName?.trim() ||
    hostnameFromProductUrl(existing.productUrl) ||
    null;
  if (site) {
    patch.siteName = site;
  }

  if (Object.keys(patch).length === 0) return;

  const db = getDb();
  await db
    .update(itemRequests)
    .set(patch)
    .where(eq(itemRequests.id, itemRequestId));
}
