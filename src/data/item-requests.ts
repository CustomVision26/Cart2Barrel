import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, type ItemRequest } from "@/db/schema";
import { isMissingBatchQuoteSessionIdColumnError } from "@/lib/db-column-missing";
import { hostnameFromProductUrl } from "@/lib/site-name";

/**
 * `item_requests` columns when `batch_quote_session_id` is not migrated yet.
 * Keep in sync with schema (excluding the batch FK only).
 */
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
  createdAt: itemRequests.createdAt,
} as const;

function withNullBatchQuoteSessionId(
  row: Omit<ItemRequest, "batchQuoteSessionId">
): ItemRequest {
  return { ...row, batchQuoteSessionId: null };
}

const ACTIVE_REQUEST_STATUSES = ["pending", "quoted"] as const satisfies Readonly<
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
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    const rows = await db
      .select(itemRequestsRowLegacySelect)
      .from(itemRequests)
      .where(eq(itemRequests.id, id))
      .limit(1);
    const row = rows[0];
    return row ? withNullBatchQuoteSessionId(row) : undefined;
  }
}

/** In-flight requests (not in cart, not closed). Includes rows attached to a batch quote
 *  (`batch_quote_session_id`) so the Products tab can show them as inactive alongside
 *  unbatched lines. Approved items live in cart only. */
export async function listActiveItemRequestsForUser(
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
          inArray(itemRequests.status, [...ACTIVE_REQUEST_STATUSES])
        )
      )
      .orderBy(desc(itemRequests.createdAt));
  } catch (e) {
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    const rows = await db
      .select(itemRequestsRowLegacySelect)
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemRequests.status, [...ACTIVE_REQUEST_STATUSES])
        )
      )
      .orderBy(desc(itemRequests.createdAt));
    return rows.map(withNullBatchQuoteSessionId);
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
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
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
    return rows.map(withNullBatchQuoteSessionId);
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
