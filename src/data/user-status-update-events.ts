import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cache } from "react";

import { getDb } from "@/db";
import {
  orderItemMerchandiseReconciliations,
  userStatusUpdateEventReads,
  userStatusUpdateEvents,
  type UserStatusUpdateKind,
} from "@/db/schema";
import {
  userStatusHrefForActiveProduct,
  userStatusHrefForAddOnCharges,
  userStatusHrefForBatchQuotes,
  userStatusHrefForDashboard,
  userStatusHrefForOrders,
  userStatusHrefForSupportTicket,
  userStatusUpdateNavSection,
  type UserStatusNavSection,
} from "@/lib/user-status-updates";
import { formatUsd } from "@/lib/admin-markup";
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

function scheduleRevalidateUserStatusSurfaces(): void {
  after(() => {
    revalidateUserStatusSurfaces();
  });
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
    scheduleRevalidateUserStatusSurfaces();
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
  staffNote?: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Product request";
  const note = params.staffNote?.trim();
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "item_out_of_stock",
    title: "Product out of stock",
    body:
      note ?
        `${label} is unavailable from the retailer. ${note}`
      : `${label} is unavailable from the retailer.`,
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

export async function recordWarehouseDeliveryReceivedActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  statusLabel: string;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "warehouse_delivery_received",
    title: "Delivery intake recorded",
    body: `${label} — ${params.statusLabel}`,
    href: userStatusHrefForOrders(params.orderItemId),
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

export async function recordHubStockPackageShippedActivity(params: {
  clerkUserId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  productCount: number;
}): Promise<void> {
  const countLabel =
    params.productCount === 1 ?
      "1 in-hub product"
    : `${params.productCount} in-hub products`;
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "purchase_tracking_updated",
    title: "Package shipped",
    body: `${countLabel} · ${params.carrier} · ${params.trackingNumber}`,
    href: userStatusHrefForOrders(params.orderId),
    entityType: "order",
    entityId: params.orderId,
  });
}

export async function recordHubStockPackageDeliveredActivity(params: {
  clerkUserId: string;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  productCount: number;
}): Promise<void> {
  const countLabel =
    params.productCount === 1 ?
      "1 in-hub product"
    : `${params.productCount} in-hub products`;
  const tracking =
    params.carrier && params.trackingNumber ?
      ` · ${params.carrier} · ${params.trackingNumber}`
    : params.carrier ? ` · ${params.carrier}`
    : "";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "warehouse_delivery_received",
    title: "Package delivered",
    body: `${countLabel} arrived at your address${tracking}.`,
    href: `/dashboard/orders-history?highlight=${encodeURIComponent(params.orderId)}`,
    entityType: "order",
    entityId: params.orderId,
  });
}

export async function recordMerchandisePriceChangeActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  body: string;
  /** When set, status update opens the support thread (not just the orders list). */
  supportTicketId?: string | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  const href =
    params.supportTicketId ?
      userStatusHrefForSupportTicket(params.supportTicketId)
    : userStatusHrefForOrders(params.orderId);
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "merchandise_price_change",
    title: "Purchase price update",
    body: `${label} — ${params.body}`,
    href,
    entityType: "order_item",
    entityId: params.orderItemId,
  });
}

export async function recordMerchandiseTopupRequiredActivity(params: {
  clerkUserId: string;
  orderId: string;
  orderItemId: string;
  productName: string | null;
  topupAmountCents: number;
  expiresAtIso: string;
}): Promise<void> {
  const label = params.productName?.trim() || "Order line";
  const expires = new Date(params.expiresAtIso);
  const when = Number.isFinite(expires.getTime())
    ? expires.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "soon";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "merchandise_topup_required",
    title: "Price increased — pay extra charge",
    body: `${label} — top-up ${formatUsd(params.topupAmountCents)} due by ${when}. Add item → Products (Active) → Top-up due row → Cart.`,
    href: userStatusHrefForAddOnCharges(),
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

export async function recordOutsidePurchasePaymentPromptActivity(params: {
  clerkUserId: string;
  itemRequestId: string;
  productName: string | null;
  totalPriceCents?: number | null;
}): Promise<void> {
  const label = params.productName?.trim() || "Outside purchase";
  const priceHint =
    params.totalPriceCents != null && params.totalPriceCents > 0 ?
      ` Service & handling due: ${formatUsd(params.totalPriceCents)}.`
    : "";
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "outside_purchase_payment_prompt",
    title: "Payment reminder",
    body: `${label} — add to cart and pay your quote.${priceHint}`,
    href: userStatusHrefForActiveProduct(params.itemRequestId),
    entityType: "item_request",
    entityId: params.itemRequestId,
  });
}

export async function recordAccountWelcomeActivity(params: {
  clerkUserId: string;
  displayName: string | null;
}): Promise<void> {
  const greeting = params.displayName?.trim();
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "account_welcome",
    title: "Welcome to Cart2Barrel",
    body:
      greeting ?
        `Hi ${greeting} — your account is ready. Submit product links for estimates or explore your dashboard.`
      : "Your account is ready. Submit product links for estimates or explore your dashboard.",
    href: userStatusHrefForDashboard(),
    entityType: "profile",
    entityId: params.clerkUserId,
  });
}

export async function recordAccountSuspendedActivity(params: {
  clerkUserId: string;
}): Promise<void> {
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "account_suspended",
    title: "Account suspended",
    body:
      "Your Cart2Barrel account has been suspended by our team. You cannot sign in until an administrator reinstates access. Contact support if you believe this is a mistake.",
    href: userStatusHrefForDashboard(),
    entityType: "profile",
    entityId: params.clerkUserId,
  });
}

export async function recordAccountReinstatedActivity(params: {
  clerkUserId: string;
}): Promise<void> {
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "account_reinstated",
    title: "Account reinstated",
    body:
      "Your account suspension has been lifted. You can sign in and use Cart2Barrel again.",
    href: userStatusHrefForDashboard(),
    entityType: "profile",
    entityId: params.clerkUserId,
  });
}

export async function recordSupportReplyActivity(params: {
  clerkUserId: string;
  ticketId: string;
  subject: string;
  preview: string;
}): Promise<void> {
  const preview =
    params.preview.trim().length > 160
      ? `${params.preview.trim().slice(0, 157)}…`
      : params.preview.trim();
  await recordUserStatusUpdateEvent({
    clerkUserId: params.clerkUserId,
    kind: "support_reply",
    title: "Support replied",
    body: `${params.subject} — ${preview}`,
    href: userStatusHrefForSupportTicket(params.ticketId),
    entityType: "support_ticket",
    entityId: params.ticketId,
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

export const loadUserStatusNotificationSummary = cache(async function loadUserStatusNotificationSummary(
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

  // Fix older price-change events that still point at Orders instead of the support thread.
  const priceChangeOrderItemIds = [
    ...new Set(
      rows
        .map((r) => r.event)
        .filter(
          (e) =>
            e.kind === "merchandise_price_change" &&
            e.entityType === "order_item" &&
            !e.href.includes("/dashboard/support/"),
        )
        .map((e) => e.entityId),
    ),
  ];
  const ticketByOrderItemId = new Map<string, string>();
  if (priceChangeOrderItemIds.length > 0) {
    try {
      const reconRows = await db
        .select({
          orderItemId: orderItemMerchandiseReconciliations.orderItemId,
          supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        })
        .from(orderItemMerchandiseReconciliations)
        .where(
          sql`${orderItemMerchandiseReconciliations.orderItemId}::text IN (${sql.join(
            priceChangeOrderItemIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      for (const r of reconRows) {
        if (r.supportTicketId) {
          ticketByOrderItemId.set(r.orderItemId, r.supportTicketId);
        }
      }
    } catch {
      // Table may be absent until migrate; leave stored hrefs as-is.
    }
  }

  let totalUnread = 0;
  let requestedItemsUnread = 0;
  let ordersUnread = 0;
  const events: UserStatusFeedEvent[] = [];

  const hrefFixes: { id: string; href: string }[] = [];

  for (const row of rows) {
    const event = mapFeedRow(row.event);
    const ticketId = ticketByOrderItemId.get(event.entityId);
    if (ticketId) {
      const supportHref = userStatusHrefForSupportTicket(ticketId);
      if (event.href !== supportHref) {
        hrefFixes.push({ id: event.id, href: supportHref });
        event.href = supportHref;
      }
    }
    totalUnread += 1;
    if (event.navSection === "requested_items") {
      requestedItemsUnread += 1;
    } else {
      ordersUnread += 1;
    }
    events.push(event);
  }

  if (hrefFixes.length > 0) {
    after(async () => {
      try {
        for (const fix of hrefFixes) {
          await db
            .update(userStatusUpdateEvents)
            .set({ href: fix.href })
            .where(eq(userStatusUpdateEvents.id, fix.id));
        }
      } catch {
        // Best-effort; feed already serves corrected hrefs.
      }
    });
  }

  return {
    totalUnread,
    requestedItemsUnread,
    ordersUnread,
    events,
  };
});

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

    scheduleRevalidateUserStatusSurfaces();
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
