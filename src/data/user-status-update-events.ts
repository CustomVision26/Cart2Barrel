import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  userStatusUpdateEventReads,
  userStatusUpdateEvents,
  type UserStatusUpdateKind,
} from "@/db/schema";
import {
  userStatusHrefForActiveProduct,
  userStatusHrefForBatchQuotes,
  userStatusHrefForOrders,
  userStatusUpdateNavSection,
  type UserStatusNavSection,
} from "@/lib/user-status-updates";
import { isMissingUserStatusUpdateTablesError } from "@/lib/db-column-missing";

const FEED_LIMIT = 80;
const FEED_LOOKBACK_DAYS = 30;

export const EMPTY_USER_STATUS_NOTIFICATION_SUMMARY: UserStatusNotificationSummary =
  {
    totalUnread: 0,
    requestedItemsUnread: 0,
    ordersUnread: 0,
    events: [],
  };

export type UserStatusFeedEvent = {
  id: string;
  kind: UserStatusUpdateKind;
  title: string;
  body: string | null;
  href: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  navSection: UserStatusNavSection;
};

export type UserStatusNotificationSummary = {
  totalUnread: number;
  requestedItemsUnread: number;
  ordersUnread: number;
  events: UserStatusFeedEvent[];
};

type RecordEventInput = {
  clerkUserId: string;
  kind: UserStatusUpdateKind;
  title: string;
  body?: string | null;
  href: string;
  entityType: string;
  entityId: string;
};

function revalidateUserStatusSurfaces(): void {
  revalidatePath("/dashboard", "layout");
}

export async function recordUserStatusUpdateEvent(
  input: RecordEventInput,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(userStatusUpdateEvents).values({
      clerkUserId: input.clerkUserId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    revalidateUserStatusSurfaces();
  } catch (e) {
    if (isMissingUserStatusUpdateTablesError(e)) {
      return;
    }
    console.error("[Cart2Barrel] recordUserStatusUpdateEvent failed:", e);
  }
}

export async function recordEstimateReadyActivity(params: {
  clerkUserId: string;
  itemRequestId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Your product";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "estimate_ready",
    title: "Estimate ready",
    body: `${label} — review and add to cart when ready.`,
    href: userStatusHrefForActiveProduct(params.itemRequestId),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

export async function recordBatchEstimateReadyActivity(params: {
  clerkUserId: string;
  batchSessionId: string;
  batchNumber: string;
  lineCount: number;
}): Promise<void> {
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "batch_estimate_ready",
    title: "Batch estimate ready",
    body: `${params.batchNumber} · ${params.lineCount} product${params.lineCount === 1 ? "" : "s"}`,
    href: userStatusHrefForBatchQuotes(params.batchSessionId),
    entityType: "batch_quote_session",
    entityId: params.batchSessionId,
  });
}

export async function recordItemOutOfStockActivity(params: {
  clerkUserId: string;
  itemRequestId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Product request";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "item_out_of_stock",
    title: "Product out of stock",
    body: `${label} is unavailable from the retailer.`,
    href: userStatusHrefForActiveProduct(params.itemRequestId),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

export async function recordCompanyPurchaseConfirmedActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "company_purchase_confirmed",
    title: "Purchase confirmed",
    body: `${label} — staff purchased from the retailer.`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordPurchaseTrackingUpdatedActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  statusLabel: string;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "purchase_tracking_updated",
    title: "Order status updated",
    body: `${label} — ${params.statusLabel}`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordRefundApprovedActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  amountCents: number;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "refund_approved",
    title: "Refund approved",
    body: `${label} — refund issued.`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordRefundRejectedActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "refund_rejected",
    title: "Refund request declined",
    body: `${label} — see orders for details.`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordProductReturnFulfilledActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "product_return_fulfilled",
    title: "Return in progress",
    body: `${label} — return tracking saved.`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordOutsidePurchaseReturnEstimateReadyActivity(params: {
  clerkUserId: string;
  itemRequestId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Outside purchase";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "outside_purchase_return_estimate_ready",
    title: "Return estimate ready",
    body: `${label} — review the return fee.`,
    href: userStatusHrefForActiveProduct(params.itemRequestId),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

function mapFeedRow(
  row: typeof userStatusUpdateEvents.$inferSelect,
): UserStatusFeedEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    navSection: userStatusUpdateNavSection(row.kind),
  };
}

export async function loadUserStatusNotificationSummary(
  clerkUserId: string,
): Promise<UserStatusNotificationSummary> {
  const db = getDb();
  const since = new Date(
    Date.now() - FEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let rows;
  try {
    rows = await db
      .select({
        event: userStatusUpdateEvents,
        readAt: userStatusUpdateEventReads.readAt,
      })
      .from(userStatusUpdateEvents)
      .leftJoin(
        userStatusUpdateEventReads,
        eq(userStatusUpdateEventReads.eventId, userStatusUpdateEvents.id),
      )
      .where(
        and(
          eq(userStatusUpdateEvents.clerkUserId, clerkUserId),
          sql`${userStatusUpdateEvents.createdAt} >= ${since}`,
          isNull(userStatusUpdateEventReads.readAt),
        ),
      )
      .orderBy(desc(userStatusUpdateEvents.createdAt))
      .limit(FEED_LIMIT);
  } catch (e) {
    if (isMissingUserStatusUpdateTablesError(e)) {
      return EMPTY_USER_STATUS_NOTIFICATION_SUMMARY;
    }
    throw e;
  }

  let totalUnread = 0;
  let requestedItemsUnread = 0;
  let ordersUnread = 0;
  const events: UserStatusFeedEvent[] = [];

  for (const row of rows) {
    const event = mapFeedRow(row.event);
    totalUnread += 1;
    if (event.navSection === "requested_items") {
      requestedItemsUnread += 1;
    } else {
      ordersUnread += 1;
    }
    events.push(event);
  }

  return {
    totalUnread,
    requestedItemsUnread,
    ordersUnread,
    events,
  };
}

export async function markUserStatusUpdateEventsRead(params: {
  clerkUserId: string;
  eventIds: string[];
}): Promise<void> {
  if (params.eventIds.length === 0) return;
  const db = getDb();
  const uniqueIds = [...new Set(params.eventIds)];

  try {
    const existing = await db
      .select({ id: userStatusUpdateEvents.id })
      .from(userStatusUpdateEvents)
      .where(
        and(
          eq(userStatusUpdateEvents.clerkUserId, params.clerkUserId),
          inArray(userStatusUpdateEvents.id, uniqueIds),
        ),
      );

    if (existing.length === 0) return;

    await db
      .insert(userStatusUpdateEventReads)
      .values(existing.map((row) => ({ eventId: row.id })))
      .onConflictDoNothing();

    revalidateUserStatusSurfaces();
  } catch (e) {
    if (isMissingUserStatusUpdateTablesError(e)) {
      return;
    }
    throw e;
  }
}

export async function markAllUserStatusUpdateEventsRead(
  clerkUserId: string,
): Promise<void> {
  const summary = await loadUserStatusNotificationSummary(clerkUserId);
  const ids = summary.events.map((e) => e.id);
  await markUserStatusUpdateEventsRead({ clerkUserId, eventIds: ids });
}
