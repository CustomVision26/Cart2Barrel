import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemRequests,
  profiles,
  shoppingListQuoteLines,
  shoppingListQuotes,
  type ItemRequest,
  type ShoppingListQuoteLine,
} from "@/db/schema";
import { ensureShoppingListQuoteSchema } from "@/data/ensure-shopping-list-quote-schema";
import {
  insertBatchEstimateRow,
  listItemRequestsForBatchSession,
  markSessionEstimated,
  randomBatchDisplayNumber,
  sumBatchTotalsFromQuotes,
  voidActiveEstimatesForSession,
  auditMemoLinesForBatch,
  collectLatestQuotesForRequests,
  detachItemRequestsFromBatchSession,
} from "@/data/batch-quote-sessions";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import {
  insertItemQuoteForRequest,
  itemRequestSnapshotForQuote,
  patchItemRequestDisplayFieldsOnly,
  voidActiveQuotesForItemRequest,
} from "@/data/item-quotes";
import { getItemRequestById } from "@/data/item-requests";
import { appendBatchQuoteSessionStatusEvent } from "@/data/batch-quote-session-status-events";
import { notifyAdminsOfBatchQuoteSubmitted } from "@/data/admin-user-activity-events";
import { recordEstimateReadyActivity } from "@/data/user-status-update-events";
import { ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT } from "@/lib/item-quote-void-reason";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";
import {
  SHOPPING_LIST_SITE_KEY,
  SHOPPING_LIST_SITE_NAME,
  shoppingListItemProductUrl,
  shoppingListLineTaxCents,
  type AdminShoppingListQuoteLineView,
  type AdminShoppingListQuoteView,
  type ShoppingListQuoteStatus,
} from "@/lib/shopping-list-quote";
import {
  SHOPPING_LIST_PHOTO_SOURCE_KIND,
  STARTER_BUNDLE_SITE_NAME,
  STARTER_BUNDLE_SOURCE_KIND,
  starterBundleItemProductUrl,
} from "@/lib/starter-bundles";
import type {
  SaveShoppingListEstimateInput,
  SubmitShoppingListQuoteInput,
} from "@/lib/validations/shopping-list-quote";
import type { SubmitStarterBundleQuoteInput } from "@/lib/validations/starter-bundle";
import { batchQuoteSessions, batchQuoteSessionLines } from "@/db/schema";
import { ensureStarterBundlesSchema } from "@/data/ensure-starter-bundles-schema";
import {
  getStarterBundleById,
  starterBundleSnapshotFromRecord,
  timestampsMatch,
  type PublishedStarterBundleDetail,
} from "@/data/starter-bundles";

export type ShoppingListQuoteLineDraft = {
  clientKey: string;
  productName: string;
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  note: string | null;
  productImageUrl: string | null;
};

export type { AdminShoppingListQuoteLineView, AdminShoppingListQuoteView };

export async function submitShoppingListQuoteForOwner(params: {
  clerkUserId: string;
  input: SubmitShoppingListQuoteInput;
}): Promise<{ listId: string; batchSessionId: string }> {
  await ensureShoppingListQuoteSchema();
  const db = getDb();
  const submittedAt = new Date().toISOString();

  const [list] = await db
    .insert(shoppingListQuotes)
    .values({
      clerkUserId: params.clerkUserId,
      sourceImageUrl: params.input.sourceImageUrl,
      sourceKind: SHOPPING_LIST_PHOTO_SOURCE_KIND,
      status: "submitted",
      updatedAt: submittedAt,
    })
    .returning();
  if (!list) throw new Error("Could not save the shopping list.");

  const lineRows: ShoppingListQuoteLine[] = [];
  for (const [index, line] of params.input.lines.entries()) {
    const [row] = await db
      .insert(shoppingListQuoteLines)
      .values({
        shoppingListQuoteId: list.id,
        sortIndex: index,
        productName: line.productName,
        quantity: line.quantity,
        productSize: line.productSize ?? null,
        productColor: line.productColor ?? null,
        note: line.note ?? null,
        productImageUrl: line.productImageUrl ?? null,
      })
      .returning();
    if (row) lineRows.push(row);
  }
  if (lineRows.length === 0) {
    throw new Error("Add at least one product before submitting.");
  }

  let session;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(batchQuoteSessions)
        .values({
          clerkUserId: params.clerkUserId,
          batchNumber: randomBatchDisplayNumber(),
          siteKey: SHOPPING_LIST_SITE_KEY,
          status: "submitted",
          submittedAt,
        })
        .returning();
      session = created;
      break;
    } catch (e) {
      const code =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        typeof (e as { code: unknown }).code === "string"
          ? (e as { code: string }).code
          : "";
      const msg = e instanceof Error ? e.message : "";
      if (code === "23505" && msg.toLowerCase().includes("batch_number")) {
        continue;
      }
      throw e;
    }
  }
  if (!session) throw new Error("Could not assign a batch number.");

  const requestIds: string[] = [];
  for (const line of lineRows) {
    const [req] = await db
      .insert(itemRequests)
      .values({
        clerkUserId: params.clerkUserId,
        productUrl: shoppingListItemProductUrl(list.id, line.id),
        productName: line.productName,
        productSize: line.productSize,
        productColor: line.productColor,
        quantity: line.quantity,
        note: line.note,
        productImageUrl: line.productImageUrl,
        siteName: SHOPPING_LIST_SITE_NAME,
        status: "pending",
        source: "customer_url",
        batchQuoteSessionId: session.id,
      })
      .returning();
    if (!req) continue;
    requestIds.push(req.id);
    await db
      .update(shoppingListQuoteLines)
      .set({ itemRequestId: req.id })
      .where(eq(shoppingListQuoteLines.id, line.id));
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "customer_submission",
      batchQuoteSessionId: session.id,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "batch_request_submitted_to_staff",
      batchQuoteSessionId: session.id,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
  }

  if (requestIds.length === 0) {
    throw new Error("Could not create product lines from this list.");
  }

  await db.insert(batchQuoteSessionLines).values(
    requestIds.map((itemRequestId) => ({
      batchQuoteSessionId: session.id,
      itemRequestId,
    })),
  );

  await db
    .update(shoppingListQuotes)
    .set({
      batchQuoteSessionId: session.id,
      updatedAt: submittedAt,
    })
    .where(eq(shoppingListQuotes.id, list.id));

  await appendBatchQuoteSessionStatusEvent({
    batchQuoteSessionId: session.id,
    clerkUserId: params.clerkUserId,
    kind: "new_batch_request",
    detail: {
      snapshot: buildBatchQuoteHistorySnapshot({
        kind: "new_batch_request",
        session,
        requests: await listItemRequestsForBatchSession(session.id),
        estimate: null,
      }),
    },
  });

  await notifyAdminsOfBatchQuoteSubmitted(session.id, params.clerkUserId);

  return { listId: list.id, batchSessionId: session.id };
}

export type SubmitStarterBundleQuoteResult =
  | { ok: true; listId: string; batchSessionId: string }
  | {
      ok: false;
      code: "stale";
      message: string;
      bundle: PublishedStarterBundleDetail;
    }
  | { ok: false; code: "archived" | "missing"; message: string };

export async function submitStarterBundleQuoteForOwner(params: {
  clerkUserId: string;
  input: SubmitStarterBundleQuoteInput;
}): Promise<SubmitStarterBundleQuoteResult> {
  await ensureShoppingListQuoteSchema();
  await ensureStarterBundlesSchema();

  const record = await getStarterBundleById(params.input.bundleId);
  if (!record) {
    return {
      ok: false,
      code: "missing",
      message: "This starter bundle is no longer available.",
    };
  }
  if (record.bundle.status === "archived") {
    return {
      ok: false,
      code: "archived",
      message: "This starter bundle is no longer available. Choose another bundle.",
    };
  }
  if (record.bundle.status !== "published") {
    return {
      ok: false,
      code: "missing",
      message: "This starter bundle is no longer available.",
    };
  }
  if (record.items.length === 0) {
    throw new Error("This bundle has no products to quote.");
  }
  if (!timestampsMatch(record.bundle.updatedAt, params.input.bundleUpdatedAt)) {
    const snapshot = starterBundleSnapshotFromRecord(record.bundle, record.items);
    return {
      ok: false,
      code: "stale",
      message:
        "This bundle was updated since you opened it. Review the current products and prices before submitting.",
      bundle: {
        id: record.bundle.id,
        name: record.bundle.name,
        description: record.bundle.description,
        imageUrl: record.bundle.imageUrl,
        barrelSize: record.bundle.barrelSize,
        barrelFillLevel: record.bundle.barrelFillLevel,
        updatedAt: record.bundle.updatedAt,
        merchandiseSubtotalCents: snapshot.merchandiseSubtotalCents,
        itemCount: record.items.length,
        items: snapshot.items.map((item, index) => ({
          id: record.items[index]?.id ?? `${record.bundle.id}-${index}`,
          ...item,
        })),
      },
    };
  }

  const snapshot = starterBundleSnapshotFromRecord(record.bundle, record.items);
  const db = getDb();
  const submittedAt = new Date().toISOString();
  const customerNote = params.input.customerNote?.trim() || null;

  const [list] = await db
    .insert(shoppingListQuotes)
    .values({
      clerkUserId: params.clerkUserId,
      sourceImageUrl: record.bundle.imageUrl,
      sourceKind: STARTER_BUNDLE_SOURCE_KIND,
      starterBundleId: record.bundle.id,
      starterBundleSnapshot: snapshot,
      customerNote,
      status: "submitted",
      updatedAt: submittedAt,
    })
    .returning();
  if (!list) throw new Error("Could not save this starter bundle request.");

  const lineRows: ShoppingListQuoteLine[] = [];
  for (const item of record.items) {
    const [row] = await db
      .insert(shoppingListQuoteLines)
      .values({
        shoppingListQuoteId: list.id,
        sortIndex: item.sortIndex,
        productName: item.productName,
        quantity: item.quantity,
        productSize: item.productSize,
        productColor: item.productColor,
        note: null,
        productImageUrl: null,
      })
      .returning();
    if (row) lineRows.push(row);
  }
  if (lineRows.length === 0) {
    throw new Error("This bundle has no products to quote.");
  }

  let session;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(batchQuoteSessions)
        .values({
          clerkUserId: params.clerkUserId,
          batchNumber: randomBatchDisplayNumber(),
          siteKey: SHOPPING_LIST_SITE_KEY,
          status: "submitted",
          submittedAt,
        })
        .returning();
      session = created;
      break;
    } catch (e) {
      const code =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        typeof (e as { code: unknown }).code === "string"
          ? (e as { code: string }).code
          : "";
      const msg = e instanceof Error ? e.message : "";
      if (code === "23505" && msg.toLowerCase().includes("batch_number")) {
        continue;
      }
      throw e;
    }
  }
  if (!session) throw new Error("Could not assign a batch number.");

  const requestIds: string[] = [];
  for (const [index, line] of lineRows.entries()) {
    const item = record.items[index];
    const [req] = await db
      .insert(itemRequests)
      .values({
        clerkUserId: params.clerkUserId,
        productUrl: item?.retailerUrl?.trim()
          ? item.retailerUrl
          : starterBundleItemProductUrl(list.id, line.id),
        productName: line.productName,
        productSize: line.productSize,
        productColor: line.productColor,
        quantity: line.quantity,
        note: null,
        productImageUrl: line.productImageUrl,
        siteName: STARTER_BUNDLE_SITE_NAME,
        status: "pending",
        source: "customer_url",
        batchQuoteSessionId: session.id,
      })
      .returning();
    if (!req) continue;
    requestIds.push(req.id);
    await db
      .update(shoppingListQuoteLines)
      .set({ itemRequestId: req.id })
      .where(eq(shoppingListQuoteLines.id, line.id));
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "customer_submission",
      batchQuoteSessionId: session.id,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "batch_request_submitted_to_staff",
      batchQuoteSessionId: session.id,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
  }

  if (requestIds.length === 0) {
    throw new Error("Could not create product lines from this bundle.");
  }

  await db.insert(batchQuoteSessionLines).values(
    requestIds.map((itemRequestId) => ({
      batchQuoteSessionId: session.id,
      itemRequestId,
    })),
  );

  await db
    .update(shoppingListQuotes)
    .set({
      batchQuoteSessionId: session.id,
      updatedAt: submittedAt,
    })
    .where(eq(shoppingListQuotes.id, list.id));

  await appendBatchQuoteSessionStatusEvent({
    batchQuoteSessionId: session.id,
    clerkUserId: params.clerkUserId,
    kind: "new_batch_request",
    detail: {
      snapshot: buildBatchQuoteHistorySnapshot({
        kind: "new_batch_request",
        session,
        requests: await listItemRequestsForBatchSession(session.id),
        estimate: null,
      }),
    },
  });

  await notifyAdminsOfBatchQuoteSubmitted(session.id, params.clerkUserId);

  return { ok: true, listId: list.id, batchSessionId: session.id };
}

export async function listSubmittedShoppingListQuotesForAdmin(opts?: {
  clerkUserId?: string;
}): Promise<AdminShoppingListQuoteView[]> {
  const ready = await ensureShoppingListQuoteSchema();
  if (!ready) return [];

  const db = getDb();
  const lists = await db
    .select({
      list: shoppingListQuotes,
      customerFullName: profiles.fullName,
      customerEmail: profiles.email,
      batchNumber: batchQuoteSessions.batchNumber,
    })
    .from(shoppingListQuotes)
    .innerJoin(profiles, eq(shoppingListQuotes.clerkUserId, profiles.clerkUserId))
    .leftJoin(
      batchQuoteSessions,
      eq(shoppingListQuotes.batchQuoteSessionId, batchQuoteSessions.id),
    )
    .where(
      opts?.clerkUserId
        ? and(
            eq(shoppingListQuotes.clerkUserId, opts.clerkUserId),
            inArray(shoppingListQuotes.status, ["submitted", "estimated"]),
          )
        : inArray(shoppingListQuotes.status, ["submitted", "estimated"]),
    )
    .orderBy(desc(shoppingListQuotes.createdAt));

  if (lists.length === 0) return [];

  const listIds = lists.map((row) => row.list.id);
  const lineRows = await db
    .select()
    .from(shoppingListQuoteLines)
    .where(inArray(shoppingListQuoteLines.shoppingListQuoteId, listIds))
    .orderBy(asc(shoppingListQuoteLines.sortIndex));

  const requestIds = lineRows
    .map((line) => line.itemRequestId)
    .filter((id): id is string => Boolean(id));
  const requestMap = new Map<string, ItemRequest>();
  if (requestIds.length > 0) {
    const reqs = await db
      .select()
      .from(itemRequests)
      .where(inArray(itemRequests.id, requestIds));
    for (const req of reqs) requestMap.set(req.id, req);
  }
  const quoteMap = await collectLatestQuotesForRequests(requestIds);

  const linesByList = new Map<string, AdminShoppingListQuoteLineView[]>();
  for (const line of lineRows) {
    const request = line.itemRequestId
      ? requestMap.get(line.itemRequestId)
      : undefined;
    if (!request) continue;
    const current = linesByList.get(line.shoppingListQuoteId) ?? [];
    current.push({
      line,
      request,
      quote: quoteMap.get(request.id) ?? null,
    });
    linesByList.set(line.shoppingListQuoteId, current);
  }

  return lists.map((row) => ({
    list: row.list,
    customerFullName: row.customerFullName,
    customerEmail: row.customerEmail,
    batchNumber: row.batchNumber,
    lines: linesByList.get(row.list.id) ?? [],
  }));
}

export async function applySaveShoppingListEstimate(
  input: SaveShoppingListEstimateInput,
  adminClerkUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureShoppingListQuoteSchema();
  const db = getDb();

  const [list] = await db
    .select()
    .from(shoppingListQuotes)
    .where(eq(shoppingListQuotes.id, input.shoppingListQuoteId))
    .limit(1);
  if (!list) return { ok: false, message: "Shopping list not found." };
  if (list.status !== "submitted" && list.status !== "estimated") {
    return { ok: false, message: "This list is not waiting for an estimate." };
  }
  if (!list.batchQuoteSessionId) {
    return { ok: false, message: "This list is missing its batch session." };
  }

  const sessionId = list.batchQuoteSessionId;
  const ownedRequests = await listItemRequestsForBatchSession(sessionId);
  const ownedIds = new Set(ownedRequests.map((r) => r.id));
  for (const line of input.lines) {
    if (!ownedIds.has(line.itemRequestId)) {
      return { ok: false, message: "A product line does not belong to this list." };
    }
  }

  for (const line of input.lines) {
    const reqBefore = await getItemRequestById(line.itemRequestId);
    if (!reqBefore) {
      return { ok: false, message: "A product line was not found." };
    }
    await insertItemRequestLineSnapshot({
      itemRequestId: line.itemRequestId,
      phase: "pre_admin_estimate_edit",
      recordedByClerkUserId: adminClerkUserId,
      line: lineSnapshotPayloadFromItemRequest(reqBefore),
    });

    await patchItemRequestDisplayFieldsOnly(line.itemRequestId, {
      productName: line.productName ?? reqBefore.productName,
      productColor: line.productColor ?? reqBefore.productColor,
      productSize: line.productSize ?? reqBefore.productSize,
      ...(line.productImageUrl !== undefined
        ? { productImageUrl: line.productImageUrl ?? null }
        : {}),
    });
    if (line.productImageUrl !== undefined) {
      await db
        .update(shoppingListQuoteLines)
        .set({ productImageUrl: line.productImageUrl ?? null })
        .where(eq(shoppingListQuoteLines.itemRequestId, line.itemRequestId));
    }
    if (line.quantity != null && line.quantity !== reqBefore.quantity) {
      await db
        .update(itemRequests)
        .set({ quantity: line.quantity, note: line.note ?? reqBefore.note })
        .where(eq(itemRequests.id, line.itemRequestId));
    } else if (line.note !== undefined) {
      await db
        .update(itemRequests)
        .set({ note: line.note ?? null })
        .where(eq(itemRequests.id, line.itemRequestId));
    }

    await voidActiveQuotesForItemRequest(
      line.itemRequestId,
      ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT,
    );
    const req = await getItemRequestById(line.itemRequestId);
    if (!req) {
      return { ok: false, message: "A product line was not found after update." };
    }
    const totalPrice =
      line.itemCost + line.serviceFee + line.estimatedShipping + line.tax;
    const snap = itemRequestSnapshotForQuote(req);
    const newQuote = await insertItemQuoteForRequest(line.itemRequestId, {
      itemCost: line.itemCost,
      serviceFee: line.serviceFee,
      packingFeeCents: 0,
      estimatedShipping: line.estimatedShipping,
      totalPrice,
      recordedByClerkUserId: adminClerkUserId,
      ...snap,
    });
    await db
      .update(itemRequests)
      .set({ status: "quoted" })
      .where(eq(itemRequests.id, line.itemRequestId));
    await insertItemRequestLineSnapshot({
      itemRequestId: line.itemRequestId,
      phase: "post_admin_estimate_edit",
      itemQuoteId: newQuote.id,
      recordedByClerkUserId: adminClerkUserId,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
    await recordEstimateReadyActivity({
      clerkUserId: req.clerkUserId,
      itemRequestId: req.id,
      productName: req.productName,
    });
  }

  const requests = await listItemRequestsForBatchSession(sessionId);
  const quoteMap = await collectLatestQuotesForRequests(requests.map((r) => r.id));
  const quotes = requests.map((r) => quoteMap.get(r.id)).filter(Boolean);
  if (quotes.length !== requests.length) {
    return { ok: false, message: "Every line must have an active quote." };
  }
  const safeQuotes = quotes as NonNullable<(typeof quotes)[number]>[];
  const sums = sumBatchTotalsFromQuotes(safeQuotes);
  const itemDiscountCents = Math.max(
    0,
    sums.batchMerchandiseTotalCents - input.siteMerchandiseCents,
  );
  const shippingDiscountCents = Math.max(
    0,
    sums.batchShippingTotalCents - input.siteShippingCents,
  );
  const saleTaxDiscountCents = Math.max(
    0,
    sums.batchSaleTaxTotalCents - input.siteSaleTaxCents,
  );
  const subtotalCents =
    input.siteMerchandiseCents +
    sums.serviceHandlingTotalCents +
    input.siteSaleTaxCents +
    input.siteShippingCents;

  await voidActiveEstimatesForSession(sessionId);
  const estimate = await insertBatchEstimateRow({
    sessionId,
    batchMerchandiseTotalCents: sums.batchMerchandiseTotalCents,
    siteMerchandiseTotalCents: input.siteMerchandiseCents,
    itemDiscountCents,
    serviceHandlingTotalCents: sums.serviceHandlingTotalCents,
    batchShippingTotalCents: sums.batchShippingTotalCents,
    siteShippingTotalCents: input.siteShippingCents,
    shippingDiscountCents,
    batchSaleTaxTotalCents: sums.batchSaleTaxTotalCents,
    siteSaleTaxTotalCents: input.siteSaleTaxCents,
    saleTaxDiscountCents,
    subtotalCents,
    staffNote: input.staffNote ?? null,
    recordedByClerkUserId: adminClerkUserId,
  });

  const sharedMemoParams = {
    batchNumber:
      (await db
        .select({ batchNumber: batchQuoteSessions.batchNumber })
        .from(batchQuoteSessions)
        .where(eq(batchQuoteSessions.id, sessionId))
        .limit(1))[0]?.batchNumber ?? "",
    estimateId: estimate.id,
    batchMerchandiseTotalCents: sums.batchMerchandiseTotalCents,
    siteMerchandiseTotalCents: input.siteMerchandiseCents,
    itemDiscountCents,
    serviceHandlingTotalCents: sums.serviceHandlingTotalCents,
    batchShippingTotalCents: sums.batchShippingTotalCents,
    siteShippingTotalCents: input.siteShippingCents,
    shippingDiscountCents,
    batchSaleTaxTotalCents: sums.batchSaleTaxTotalCents,
    siteSaleTaxTotalCents: input.siteSaleTaxCents,
    saleTaxDiscountCents,
    subtotalCents,
  };

  const customerMemo = auditMemoLinesForBatch({
    ...sharedMemoParams,
    audience: "customer",
  });
  const adminMemo = auditMemoLinesForBatch({
    ...sharedMemoParams,
    audience: "admin",
  });

  for (const req of requests) {
    const line = lineSnapshotPayloadFromItemRequest(req);
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "batch_estimate_customer_copy",
      batchQuoteSessionId: sessionId,
      auditMemo: customerMemo,
      line,
    });
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "batch_estimate_admin_copy",
      batchQuoteSessionId: sessionId,
      auditMemo: adminMemo,
      recordedByClerkUserId: adminClerkUserId,
      line,
    });
  }

  await markSessionEstimated(sessionId, estimate);
  await detachItemRequestsFromBatchSession(sessionId);
  await db
    .update(shoppingListQuotes)
    .set({ status: "estimated", updatedAt: new Date().toISOString() })
    .where(eq(shoppingListQuotes.id, list.id));

  return { ok: true };
}

export type { ShoppingListQuoteStatus };
export { shoppingListLineTaxCents };
