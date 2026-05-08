import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, type ItemRequest } from "@/db/schema";
import { hostnameFromProductUrl } from "@/lib/site-name";

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
  const rows = await db
    .select()
    .from(itemRequests)
    .where(eq(itemRequests.id, id))
    .limit(1);
  return rows[0];
}

/** In-flight requests (not in cart, not closed). Approved items live in cart only. */
export async function listActiveItemRequestsForUser(
  clerkUserId: string
): Promise<ItemRequest[]> {
  const db = getDb();
  return db
    .select()
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        inArray(itemRequests.status, [...ACTIVE_REQUEST_STATUSES])
      )
    )
    .orderBy(desc(itemRequests.createdAt));
}

/** Approved (in cart), removed-from-cart, and rejected records. */
export async function listProductHistoryForUser(
  clerkUserId: string
): Promise<ItemRequest[]> {
  const db = getDb();
  return db
    .select()
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        inArray(itemRequests.status, [...PRODUCT_HISTORY_STATUSES])
      )
    )
    .orderBy(desc(itemRequests.createdAt));
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
