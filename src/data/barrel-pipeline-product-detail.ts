import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessionLines,
  batchQuoteSessions,
  itemRequestLineSnapshots,
  itemRequests,
  orderItems,
  orders,
  type ItemQuote,
  type ItemRequestLineSnapshot,
} from "@/db/schema";
import { listItemQuotesForOwnerByRequestIds } from "@/data/item-quotes";
import type { BarrelPipelineProductDetail } from "@/lib/barrel-pipeline-product-detail";
import {
  computeBatchLineShares,
  type BatchLineShare,
} from "@/lib/batch-line-share";
import {
  isOutsidePurchaseRequest,
  outsidePurchaseReferenceDisplay,
} from "@/lib/outside-purchase";

const batchDirect = alias(batchQuoteSessions, "ptb_detail_batch_direct");
const batchViaLine = alias(batchQuoteSessions, "ptb_detail_batch_via_line");

type PipelineLineInput = {
  orderItemId: string;
  orderId: string;
  fulfillmentLabel: string;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function latestSnapshotByPhases(
  snapshots: ItemRequestLineSnapshot[],
  phases: ItemRequestLineSnapshot["phase"][],
): ItemRequestLineSnapshot | null {
  for (const snap of snapshots) {
    if (phases.includes(snap.phase)) return snap;
  }
  return null;
}

function earliestSnapshotByPhases(
  snapshots: ItemRequestLineSnapshot[],
  phases: ItemRequestLineSnapshot["phase"][],
): ItemRequestLineSnapshot | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snap = snapshots[i];
    if (snap && phases.includes(snap.phase)) return snap;
  }
  return null;
}

function quoteFromCheckoutSnapshot(
  snapshots: ItemRequestLineSnapshot[],
  quotesById: Map<string, ItemQuote>,
): ItemQuote | null {
  const checkoutSnap = latestSnapshotByPhases(snapshots, [
    "checkout_paid_pending_delivery",
    "outside_purchase_checkout_paid",
  ]);
  if (checkoutSnap?.itemQuoteId) {
    return quotesById.get(checkoutSnap.itemQuoteId) ?? null;
  }
  return null;
}

function latestQuoteForRequest(
  itemRequestId: string,
  quotes: ItemQuote[],
): ItemQuote | null {
  const forRequest = quotes.filter((q) => q.itemRequestId === itemRequestId && !q.voidedAt);
  if (forRequest.length === 0) return null;
  return (
    [...forRequest].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null
  );
}

async function resolveBatchEstimateForSession(
  batchSessionId: string,
  clerkUserId: string,
) {
  const db = getDb();
  const [session] = await db
    .select({
      cartAcceptanceAcceptedEstimateId:
        batchQuoteSessions.cartAcceptanceAcceptedEstimateId,
    })
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, clerkUserId),
      )!,
    )
    .limit(1);
  if (!session) return null;

  const preferredId = session.cartAcceptanceAcceptedEstimateId;
  if (preferredId) {
    const [row] = await db
      .select()
      .from(batchQuoteEstimates)
      .where(
        and(
          eq(batchQuoteEstimates.id, preferredId),
          eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
          isNull(batchQuoteEstimates.voidedAt),
        )!,
      )
      .limit(1);
    if (row) return row;
  }

  const [latest] = await db
    .select()
    .from(batchQuoteEstimates)
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, batchSessionId),
        isNull(batchQuoteEstimates.voidedAt),
      )!,
    )
    .orderBy(desc(batchQuoteEstimates.createdAt))
    .limit(1);
  return latest ?? null;
}

export async function loadBarrelPipelineProductDetailsForUser(
  clerkUserId: string,
  lines: PipelineLineInput[],
): Promise<Map<string, BarrelPipelineProductDetail>> {
  const map = new Map<string, BarrelPipelineProductDetail>();
  if (lines.length === 0) return map;

  const orderItemIds = lines.map((l) => l.orderItemId);
  const db = getDb();

  const rows = await db
    .select({
      orderItem: orderItems,
      request: itemRequests,
      resolvedBatchSessionId: batchDirect.id,
      resolvedBatchSessionIdViaLine: batchViaLine.id,
      resolvedBatchNumber: batchDirect.batchNumber,
      resolvedBatchNumberViaLine: batchViaLine.batchNumber,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
    )
    .leftJoin(
      batchViaLine,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
    )
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        inArray(orderItems.id, orderItemIds),
      )!,
    );

  const lineMetaByOrderItemId = new Map(
    lines.map((l) => [l.orderItemId, l] as const),
  );

  const itemRequestIds = [...new Set(rows.map((r) => r.request.id))];
  const snapshots = await db
    .select()
    .from(itemRequestLineSnapshots)
    .where(inArray(itemRequestLineSnapshots.itemRequestId, itemRequestIds))
    .orderBy(desc(itemRequestLineSnapshots.createdAt));

  const snapshotsByRequestId = new Map<string, ItemRequestLineSnapshot[]>();
  for (const snap of snapshots) {
    const list = snapshotsByRequestId.get(snap.itemRequestId) ?? [];
    list.push(snap);
    snapshotsByRequestId.set(snap.itemRequestId, list);
  }

  const allQuotes = await listItemQuotesForOwnerByRequestIds(
    clerkUserId,
    itemRequestIds,
  );
  const quotesById = new Map(allQuotes.map((q) => [q.id, q] as const));

  const batchSessionIds = [
    ...new Set(
      rows
        .map(
          (r) =>
            r.resolvedBatchSessionId ??
            r.resolvedBatchSessionIdViaLine ??
            null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const batchEstimates = new Map<string, Awaited<ReturnType<typeof resolveBatchEstimateForSession>>>();
  const batchLineIds = new Map<string, string[]>();
  for (const sessionId of batchSessionIds) {
    batchEstimates.set(
      sessionId,
      await resolveBatchEstimateForSession(sessionId, clerkUserId),
    );
    const lineIds = await db
      .select({ itemRequestId: batchQuoteSessionLines.itemRequestId })
      .from(batchQuoteSessionLines)
      .where(eq(batchQuoteSessionLines.batchQuoteSessionId, sessionId));
    const directIds = rows
      .filter(
        (r) =>
          (r.resolvedBatchSessionId ?? r.resolvedBatchSessionIdViaLine) ===
          sessionId,
      )
      .map((r) => r.request.id);
    batchLineIds.set(sessionId, [
      ...new Set([
        ...lineIds.map((l) => l.itemRequestId),
        ...directIds,
      ]),
    ]);
  }

  const batchShareByRequestId = new Map<string, BatchLineShare>();
  for (const sessionId of batchSessionIds) {
    const estimate = batchEstimates.get(sessionId);
    const lineIds = batchLineIds.get(sessionId) ?? [];
    if (!estimate || lineIds.length === 0) continue;
    const shares = computeBatchLineShares(estimate, lineIds, (id) =>
      latestQuoteForRequest(id, allQuotes),
    );
    for (const [requestId, share] of shares) {
      batchShareByRequestId.set(requestId, share);
    }
  }

  for (const row of rows) {
    const meta = lineMetaByOrderItemId.get(row.orderItem.id);
    if (!meta) continue;

    const request = row.request;
    const requestSnapshots = snapshotsByRequestId.get(request.id) ?? [];
    const outsidePurchase = isOutsidePurchaseRequest(request);
    const batchSessionId =
      row.resolvedBatchSessionId ?? row.resolvedBatchSessionIdViaLine ?? null;
    const batchNumber =
      trimOrNull(row.resolvedBatchNumber) ??
      trimOrNull(row.resolvedBatchNumberViaLine);
    const isBatched = batchSessionId != null;

    const submissionSnap = earliestSnapshotByPhases(requestSnapshots, [
      "customer_submission",
      "customer_line_edit",
    ]);
    const warehouseSnap = latestSnapshotByPhases(requestSnapshots, [
      "warehouse_delivery_received",
      "warehouse_delivery_received_prior",
    ]);

    const requestedSize =
      outsidePurchase ?
        null
      : trimOrNull(submissionSnap?.productSize) ??
        trimOrNull(request.productSize);
    const requestedColor =
      outsidePurchase ?
        null
      : trimOrNull(submissionSnap?.productColor) ??
        trimOrNull(request.productColor);
    const receivedSize =
      outsidePurchase ?
        trimOrNull(request.productSize)
      : trimOrNull(warehouseSnap?.productSize) ??
        trimOrNull(request.productSize);
    const receivedColor =
      outsidePurchase ?
        trimOrNull(request.productColor)
      : trimOrNull(warehouseSnap?.productColor) ??
        trimOrNull(request.productColor);

    const checkoutQuote =
      quoteFromCheckoutSnapshot(requestSnapshots, quotesById) ??
      latestQuoteForRequest(request.id, allQuotes);

    const batchEstimate = batchSessionId ?
      batchEstimates.get(batchSessionId) ?? null
    : null;

    map.set(row.orderItem.id, {
      orderItemId: row.orderItem.id,
      itemRequestId: request.id,
      productName: request.productName?.trim() || "Unnamed product",
      productUrl: request.productUrl,
      productImageUrl: request.productImageUrl ?? null,
      siteName: request.siteName ?? null,
      quantity: row.orderItem.quantity,
      isOutsidePurchase: outsidePurchase,
      outsidePurchaseReference: outsidePurchaseReferenceDisplay(request),
      requestedSize,
      requestedColor,
      receivedSize,
      receivedColor,
      fulfillmentLabel: meta.fulfillmentLabel,
      assignedContainerAlias: meta.assignedContainerAlias,
      assignedAt: meta.assignedAt,
      isBatched,
      batchNumber,
      singleQuote: isBatched ? null : checkoutQuote,
      batchShare: isBatched ? (batchShareByRequestId.get(request.id) ?? null) : null,
      batchEstimateNote: batchEstimate?.staffNote?.trim() || null,
    });
  }

  return map;
}
