import { desc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemQuotes,
  itemRequests,
  orderItems,
  orders,
  profiles,
  type ItemQuote,
  type ItemRequest,
  type Order,
} from "@/db/schema";
import { itemQuoteCoreSelect } from "@/data/item-quotes";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION } from "@/lib/item-quote-void-reason";

import type { User } from "@clerk/nextjs/server";

export type AdminQuoteHistoryLine = {
  quote: ItemQuote;
  request: ItemRequest;
  userFullName: string | null;
  userEmail: string | null;
  /** When set, the line is on an order and is excluded from the customer cart. */
  orderStatus: Order["status"] | null;
};

export type AdminQuoteHistoryGroup = {
  clerkUserId: string;
  userFullName: string | null;
  userEmail: string | null;
  lines: AdminQuoteHistoryLine[];
};

function submitterDisplayName(
  fullName: string | null,
  email: string | null
): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail;
  return "Unknown user";
}

/**
 * Saved estimates by customer for admin review. Superseded rows from a customer
 * “request new estimate” resend are omitted so resends stay on Active requests only.
 */
type QuoteHistoryRow = {
  quote: ItemQuote;
  request: ItemRequest;
  userFullName: string | null;
  userEmail: string | null;
};

async function fetchQuoteHistoryRows(db: ReturnType<typeof getDb>): Promise<QuoteHistoryRow[]> {
  try {
    return await db
      .select({
        quote: itemQuotes,
        request: itemRequests,
        userFullName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(itemQuotes)
      .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .where(
        or(
          isNull(itemQuotes.voidedAt),
          isNull(itemQuotes.voidReason),
          ne(itemQuotes.voidReason, ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION)
        )
      )
      .orderBy(desc(itemQuotes.createdAt));
  } catch (e) {
    if (!isUndefinedColumnError(e, "checkout_snapshot_kind")) {
      throw e;
    }
    const narrow = await db
      .select({
        quote: itemQuoteCoreSelect,
        request: itemRequests,
        userFullName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(itemQuotes)
      .innerJoin(itemRequests, eq(itemQuotes.itemRequestId, itemRequests.id))
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .where(
        or(
          isNull(itemQuotes.voidedAt),
          isNull(itemQuotes.voidReason),
          ne(itemQuotes.voidReason, ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION)
        )
      )
      .orderBy(desc(itemQuotes.createdAt));
    return narrow.map((r) => ({
      quote: { ...r.quote, checkoutSnapshotKind: null },
      request: r.request,
      userFullName: r.userFullName,
      userEmail: r.userEmail,
    }));
  }
}

export async function listQuoteHistoryGroupedForAdmin(
  clerkUser: User | null
): Promise<AdminQuoteHistoryGroup[]> {
  if (!isClerkAdmin(clerkUser)) {
    return [];
  }

  const db = getDb();
  const rows = await fetchQuoteHistoryRows(db);

  const requestIds = [...new Set(rows.map((r) => r.request.id))];
  const orderStatusByRequestId = new Map<string, Order["status"]>();
  if (requestIds.length > 0) {
    const orderLinks = await db
      .select({
        itemRequestId: orderItems.itemRequestId,
        orderStatus: orders.status,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orderItems.itemRequestId, requestIds));
    for (const link of orderLinks) {
      orderStatusByRequestId.set(link.itemRequestId, link.orderStatus);
    }
  }

  const map = new Map<string, AdminQuoteHistoryLine[]>();
  for (const row of rows) {
    const uid = row.request.clerkUserId;
    const line: AdminQuoteHistoryLine = {
      quote: row.quote,
      request: row.request,
      userFullName: row.userFullName,
      userEmail: row.userEmail,
      orderStatus: orderStatusByRequestId.get(row.request.id) ?? null,
    };
    const list = map.get(uid);
    if (list) list.push(line);
    else map.set(uid, [line]);
  }

  const groups: AdminQuoteHistoryGroup[] = Array.from(map.entries()).map(
    ([clerkUserId, lines]) => ({
      clerkUserId,
      userFullName: lines[0]?.userFullName ?? null,
      userEmail: lines[0]?.userEmail ?? null,
      lines,
    })
  );

  groups.sort((a, b) =>
    submitterDisplayName(a.userFullName, a.userEmail).localeCompare(
      submitterDisplayName(b.userFullName, b.userEmail),
      undefined,
      { sensitivity: "base" }
    )
  );

  return groups;
}
