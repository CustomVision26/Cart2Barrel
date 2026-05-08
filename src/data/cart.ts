import { and, desc, eq, inArray, notExists } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemQuotes,
  itemRequestLineSnapshots,
  itemRequests,
  orderItems,
  type ItemQuote,
  type ItemRequest,
} from "@/db/schema";
import { itemQuoteCoreSelect } from "@/data/item-quotes";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import { isUndefinedColumnError } from "@/lib/db-column-missing";

export type CartLine = {
  request: ItemRequest;
  quote: ItemQuote;
  taxCents: number;
  /** Best HTTPS thumbnail URL for the cart row (live request field or latest audit snapshot). */
  displayProductImageUrl: string | null;
};

function notInAnyOrderClause() {
  const db = getDb();
  return notExists(
    db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.itemRequestId, itemRequests.id))
  );
}

async function fetchQuotesForCartItemRequests(
  itemRequestIds: string[]
): Promise<ItemQuote[]> {
  if (itemRequestIds.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemQuotes)
      .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
  } catch (e) {
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    const rows = await db
      .select(itemQuoteCoreSelect)
      .from(itemQuotes)
      .where(inArray(itemQuotes.itemRequestId, itemRequestIds));
    return rows.map((r) => ({
      ...r,
      checkoutSnapshotKind: null,
    }));
  }
}

export async function countApprovedCartItemsForUser(
  clerkUserId: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: itemRequests.id })
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "approved"),
        notInAnyOrderClause()
      )
    );
  return rows.length;
}

/**
 * Approved item requests with their latest quote (cart-ready lines).
 */
export async function listApprovedCartLinesForUser(
  clerkUserId: string
): Promise<CartLine[]> {
  const db = getDb();
  const requests = await db
    .select()
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.clerkUserId, clerkUserId),
        eq(itemRequests.status, "approved"),
        notInAnyOrderClause()
      )
    )
    .orderBy(desc(itemRequests.createdAt));

  if (requests.length === 0) {
    return [];
  }

  const ids = requests.map((r) => r.id);
  const quotes = await fetchQuotesForCartItemRequests(ids);

  const snapshotRows =
    ids.length === 0
      ? []
      : await db
          .select({
            itemRequestId: itemRequestLineSnapshots.itemRequestId,
            productImageUrl: itemRequestLineSnapshots.productImageUrl,
          })
          .from(itemRequestLineSnapshots)
          .where(inArray(itemRequestLineSnapshots.itemRequestId, ids))
          .orderBy(desc(itemRequestLineSnapshots.createdAt));

  const newestSnapshotImageByRequestId = new Map<string, string>();
  for (const row of snapshotRows) {
    const url = row.productImageUrl?.trim();
    if (!url || newestSnapshotImageByRequestId.has(row.itemRequestId)) continue;
    newestSnapshotImageByRequestId.set(row.itemRequestId, url);
  }

  const latestByRequest = new Map<string, ItemQuote>();
  for (const q of quotes) {
    if (q.voidedAt != null) continue;
    if (!isOperationalQuoteRow(q)) continue;
    const prev = latestByRequest.get(q.itemRequestId);
    if (
      !prev ||
      new Date(q.createdAt).getTime() > new Date(prev.createdAt).getTime()
    ) {
      latestByRequest.set(q.itemRequestId, q);
    }
  }

  const lines: CartLine[] = [];
  for (const request of requests) {
    const quote = latestByRequest.get(request.id);
    if (!quote) continue;
    const taxCents = Math.max(
      0,
      quote.totalPrice -
        quote.itemCost -
        quote.serviceFee -
        quote.estimatedShipping
    );
    const fromRequest = request.productImageUrl?.trim() || null;
    const displayProductImageUrl =
      fromRequest ?? newestSnapshotImageByRequestId.get(request.id) ?? null;
    lines.push({ request, quote, taxCents, displayProductImageUrl });
  }

  return lines;
}
