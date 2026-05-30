import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getDb } from "@/db";
import {
  adminUserActivityEventReads,
  adminUserActivityEvents,
  batchQuoteSessions,
  itemRequests,
  orderItems,
  profiles,
  type AdminUserActivityEventKind,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  adminActivityEventNavSection,
  adminActivityHrefForBatchSubmitted,
  adminActivityHrefForAllUsers,
  adminActivityHrefForItemRequestQueue,
  adminActivityHrefForOrders,
  adminActivityHrefForOutsidePurchase,
  adminActivityHrefForPurchaseOrders,
  adminActivityHrefForSupportTicket,
  type AdminActivityNavSection,
} from "@/lib/admin-user-activity";
import { isMissingAdminUserActivityTablesError } from "@/lib/db-column-missing";

const FEED_LIMIT = 80;
const FEED_LOOKBACK_DAYS = 30;

export const EMPTY_ADMIN_ACTIVITY_NOTIFICATION_SUMMARY: AdminActivityNotificationSummary =
  {
    totalUnread: 0,
    itemRequestsUnread: 0,
    ordersUnread: 0,
    groups: [],
  };

export type AdminActivityFeedEvent = {
  id: string;
  kind: AdminUserActivityEventKind;
  title: string;
  body: string | null;
  href: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  navSection: AdminActivityNavSection;
};

export type AdminActivityCustomerGroup = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  events: AdminActivityFeedEvent[];
  unreadCount: number;
};

export type AdminActivityNotificationSummary = {
  totalUnread: number;
  itemRequestsUnread: number;
  ordersUnread: number;
  groups: AdminActivityCustomerGroup[];
};

type RecordEventInput = {
  customerClerkUserId: string;
  kind: AdminUserActivityEventKind;
  title: string;
  body?: string | null;
  href: string;
  entityType: string;
  entityId: string;
};

function revalidateAdminActivitySurfaces(): void {
  revalidatePath("/admin", "layout");
}

function scheduleRevalidateAdminActivitySurfaces(): void {
  after(() => {
    revalidateAdminActivitySurfaces();
  });
}

export async function recordAdminUserActivityEvent(
  input: RecordEventInput,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(adminUserActivityEvents).values({
      customerClerkUserId: input.customerClerkUserId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    scheduleRevalidateAdminActivitySurfaces();
  } catch (e) {
    if (isMissingAdminUserActivityTablesError(e)) {
      return;
    }
    console.error("[Cart2Barrel] recordAdminUserActivityEvent failed:", e);
  }
}

export async function recordItemRequestSubmittedActivity(params: {
  customerClerkUserId: string;
  itemRequestId: string;
  productName: string | null;
  siteName: string | null;
}): Promise<void> {
  const label =
    params.productName?.trim() ||
    params.siteName?.trim() ||
    "New product request";
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "item_request_submitted",
    title: "New estimate request",
    body: label,
    href: adminActivityHrefForItemRequestQueue(
      params.customerClerkUserId,
      params.itemRequestId,
    ),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

export async function recordBatchQuoteSubmittedActivity(params: {
  customerClerkUserId: string;
  batchSessionId: string;
  batchNumber: string;
  lineCount: number;
}): Promise<void> {
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "batch_quote_submitted",
    title: "Batch estimate request submitted",
    body: `${params.batchNumber} · ${params.lineCount} product${params.lineCount === 1 ? "" : "s"}`,
    href: adminActivityHrefForBatchSubmitted(
      params.customerClerkUserId,
      params.batchSessionId,
    ),
    entityType: "batch_quote_session",
    entityId: params.batchSessionId,
  });
}

export async function recordBatchEstimateAcceptedActivity(params: {
  customerClerkUserId: string;
  batchSessionId: string;
  batchNumber: string;
}): Promise<void> {
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "batch_estimate_accepted",
    title: "Batch estimate accepted to cart",
    body: params.batchNumber,
    href: adminActivityHrefForBatchSubmitted(
      params.customerClerkUserId,
      params.batchSessionId,
    ),
    entityType: "batch_quote_session",
    entityId: params.batchSessionId,
  });
}

export async function recordCheckoutPaymentSucceededActivity(params: {
  orderId: string;
  customerClerkUserId: string;
  totalAmountCents: number;
}): Promise<void> {
  const db = getDb();
  const lines = await db
    .select({
      productName: itemRequests.productName,
    })
    .from(orderItems)
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(orderItems.orderId, params.orderId))
    .limit(3);

  const names = lines
    .map((l) => l.productName?.trim())
    .filter((n): n is string => Boolean(n));
  const body =
    names.length > 0
      ? `${names.join(", ")}${lines.length > names.length ? "…" : ""} · ${formatUsd(params.totalAmountCents)}`
      : formatUsd(params.totalAmountCents);

  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "checkout_payment_succeeded",
    title: "Checkout payment succeeded",
    body,
    href: adminActivityHrefForOrders(params.customerClerkUserId, params.orderId),
    entityType: "order",
    entityId: params.orderId,
  });
}

export async function recordRefundRequestSubmittedActivity(params: {
  customerClerkUserId: string;
  orderItemId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "refund_request_submitted",
    title: "Refund request submitted",
    body: label,
    href: adminActivityHrefForPurchaseOrders(params.customerClerkUserId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordProductReturnRequestedActivity(params: {
  customerClerkUserId: string;
  orderItemId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "product_return_requested",
    title: "Product return requested",
    body: label,
    href: adminActivityHrefForPurchaseOrders(params.customerClerkUserId),
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordOutsidePurchaseReturnSubmittedActivity(params: {
  customerClerkUserId: string;
  itemRequestId: string;
  productName: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Outside purchase";
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "outside_purchase_return_submitted",
    title: "Outside purchase return requested",
    body: label,
    href: adminActivityHrefForOutsidePurchase(params.customerClerkUserId),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

export async function recordUserRegisteredActivity(params: {
  customerClerkUserId: string;
  displayName: string | null;
  email: string | null;
}): Promise<void> {
  const label =
    params.displayName?.trim() ||
    params.email?.trim() ||
    params.customerClerkUserId.slice(0, 12);
  const body = params.email?.trim() || null;
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "user_registered",
    title: "New account registered",
    body: body ? `${label} · ${body}` : label,
    href: adminActivityHrefForAllUsers(params.customerClerkUserId),
    entityType: "profile",
    entityId: params.customerClerkUserId,
  });
}

export async function recordUserBannedActivity(params: {
  customerClerkUserId: string;
  displayName: string | null;
  email: string | null;
  bannedByDisplayName: string;
}): Promise<void> {
  const label =
    params.displayName?.trim() ||
    params.email?.trim() ||
    params.customerClerkUserId.slice(0, 12);
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "user_banned",
    title: "Account suspended",
    body: `${label} — banned by ${params.bannedByDisplayName}`,
    href: adminActivityHrefForAllUsers(params.customerClerkUserId),
    entityType: "profile",
    entityId: params.customerClerkUserId,
  });
}

export async function recordSupportTicketSubmittedActivity(params: {
  customerClerkUserId: string;
  ticketId: string;
  subject: string;
}): Promise<void> {
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "support_ticket_submitted",
    title: "New support message",
    body: params.subject,
    href: adminActivityHrefForSupportTicket(
      params.customerClerkUserId,
      params.ticketId,
    ),
    entityType: "support_ticket",
    entityId: params.ticketId,
  });
}

export async function recordSupportTicketRepliedActivity(params: {
  customerClerkUserId: string;
  ticketId: string;
  subject: string;
  preview: string;
}): Promise<void> {
  const preview =
    params.preview.trim().length > 120
      ? `${params.preview.trim().slice(0, 117)}…`
      : params.preview.trim();
  await recordAdminUserActivityEvent({
    customerClerkUserId: params.customerClerkUserId,
    kind: "support_ticket_replied",
    title: "Customer replied to support",
    body: `${params.subject} — ${preview}`,
    href: adminActivityHrefForSupportTicket(
      params.customerClerkUserId,
      params.ticketId,
    ),
    entityType: "support_ticket",
    entityId: params.ticketId,
  });
}

function mapFeedRow(
  row: typeof adminUserActivityEvents.$inferSelect,
): AdminActivityFeedEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    navSection: adminActivityEventNavSection(row.kind),
  };
}

export async function loadAdminActivityNotificationSummary(
  adminClerkUserId: string,
): Promise<AdminActivityNotificationSummary> {
  const db = getDb();
  const since = new Date(
    Date.now() - FEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let rows;
  try {
    rows = await db
      .select({
        event: adminUserActivityEvents,
        readAt: adminUserActivityEventReads.readAt,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(adminUserActivityEvents)
      .leftJoin(
        adminUserActivityEventReads,
        and(
          eq(adminUserActivityEventReads.eventId, adminUserActivityEvents.id),
          eq(adminUserActivityEventReads.adminClerkUserId, adminClerkUserId),
        ),
      )
      .innerJoin(
        profiles,
        eq(adminUserActivityEvents.customerClerkUserId, profiles.clerkUserId),
      )
      .where(
        and(
          sql`${adminUserActivityEvents.createdAt} >= ${since}`,
          isNull(adminUserActivityEventReads.readAt),
        ),
      )
      .orderBy(desc(adminUserActivityEvents.createdAt))
      .limit(FEED_LIMIT);
  } catch (e) {
    if (isMissingAdminUserActivityTablesError(e)) {
      return EMPTY_ADMIN_ACTIVITY_NOTIFICATION_SUMMARY;
    }
    throw e;
  }

  let totalUnread = 0;
  let itemRequestsUnread = 0;
  let ordersUnread = 0;

  const groupMap = new Map<string, AdminActivityCustomerGroup>();

  for (const row of rows) {
    const event = mapFeedRow(row.event);
    totalUnread += 1;
    if (event.navSection === "item_requests") {
      itemRequestsUnread += 1;
    } else {
      ordersUnread += 1;
    }

    const displayName =
      row.fullName?.trim() ||
      row.email?.trim() ||
      row.event.customerClerkUserId.slice(0, 12);

    let group = groupMap.get(row.event.customerClerkUserId);
    if (!group) {
      group = {
        clerkUserId: row.event.customerClerkUserId,
        displayName,
        email: row.email,
        events: [],
        unreadCount: 0,
      };
      groupMap.set(row.event.customerClerkUserId, group);
    }
    group.events.push(event);
    group.unreadCount += 1;
  }

  const groups = [...groupMap.values()].sort((a, b) => {
    const aTime = a.events[0]?.createdAt ?? "";
    const bTime = b.events[0]?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });

  return {
    totalUnread,
    itemRequestsUnread,
    ordersUnread,
    groups,
  };
}

export async function markAdminActivityEventsRead(params: {
  adminClerkUserId: string;
  eventIds: string[];
}): Promise<void> {
  if (params.eventIds.length === 0) return;
  const db = getDb();
  const uniqueIds = [...new Set(params.eventIds)];

  try {
    const existing = await db
      .select({ id: adminUserActivityEvents.id })
      .from(adminUserActivityEvents)
      .where(inArray(adminUserActivityEvents.id, uniqueIds));

    if (existing.length === 0) return;

    await db
      .insert(adminUserActivityEventReads)
      .values(
        existing.map((row) => ({
          eventId: row.id,
          adminClerkUserId: params.adminClerkUserId,
        })),
      )
      .onConflictDoNothing();

    scheduleRevalidateAdminActivitySurfaces();
  } catch (e) {
    if (isMissingAdminUserActivityTablesError(e)) {
      return;
    }
    throw e;
  }
}

export async function markAllAdminActivityEventsRead(
  adminClerkUserId: string,
): Promise<void> {
  const summary = await loadAdminActivityNotificationSummary(adminClerkUserId);
  const ids = summary.groups.flatMap((g) => g.events.map((e) => e.id));
  await markAdminActivityEventsRead({ adminClerkUserId, eventIds: ids });
}

/** Hook from batch submit data layer after session moves to `submitted`. */
export async function notifyAdminsOfBatchQuoteSubmitted(
  sessionId: string,
  clerkUserId: string,
): Promise<void> {
  const db = getDb();
  const [session] = await db
    .select({
      batchNumber: batchQuoteSessions.batchNumber,
    })
    .from(batchQuoteSessions)
    .where(eq(batchQuoteSessions.id, sessionId))
    .limit(1);
  if (!session) return;

  const lineCountRows = await db
    .select({ id: itemRequests.id })
    .from(itemRequests)
    .where(eq(itemRequests.batchQuoteSessionId, sessionId));

  await recordBatchQuoteSubmittedActivity({
    customerClerkUserId: clerkUserId,
    batchSessionId: sessionId,
    batchNumber: session.batchNumber,
    lineCount: lineCountRows.length,
  });
}
