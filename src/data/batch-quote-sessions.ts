import { randomBytes } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  batchQuoteEstimates,
  batchQuoteSessionLines,
  batchQuoteSessions,
  profiles,
  itemRequestLineSnapshots,
  itemRequests,
  type BatchQuoteEstimate,
  type BatchQuoteSession,
  type BatchQuoteSessionLine,
  type BatchQuoteSessionStatusEvent,
  type ItemQuote,
  type ItemRequest,
  type ItemRequestLineSnapshot,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import type { AdminSubmittedBatchListQuery } from "@/lib/admin-submitted-batch-list-params";
import {
  isMissingBatchQuoteSessionIdColumnError,
  isMissingOutsidePurchaseReceiptImageUrlColumnError,
  isUndefinedColumnError,
  shouldUseBatchQuoteSchemaFallback,
} from "@/lib/db-column-missing";
import { validateQuotedFullSiteSelection } from "@/lib/batch-quote-validation";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import {
  getLatestQuoteForItemRequest,
  restoreOrphanQuotedItemRequestQuote,
} from "@/data/item-quotes";
import {
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  withLegacyItemRequestDefaults,
} from "@/data/item-requests";
import {
  appendBatchQuoteSessionStatusEvent,
  listBatchQuoteSessionStatusEventsForSessions,
} from "@/data/batch-quote-session-status-events";
import { notifyAdminsOfBatchQuoteSubmitted } from "@/data/admin-user-activity-events";
import { recordBatchEstimateReadyActivity } from "@/data/user-status-update-events";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";

export type OwnerBatchQuoteSessionBundle = {
  session: BatchQuoteSession;
  lineRows: BatchQuoteSessionLine[];
  requests: ItemRequest[];
  latestEstimate: BatchQuoteEstimate | null;
  statusEvents: BatchQuoteSessionStatusEvent[];
};

async function selectOwnedItemRequestsByIds(
  clerkUserId: string,
  ids: string[]
): Promise<ItemRequest[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemRequests.id, ids)
        )
      );
  } catch (e) {
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.id, ids)
          )
        );
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
            inArray(itemRequests.id, ids)
          )
        );
      return rows.map(withLegacyItemRequestDefaults);
    }
  }
}

async function selectItemRequestsByIds(ids: string[]): Promise<ItemRequest[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemRequests)
      .where(inArray(itemRequests.id, ids));
  } catch (e) {
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(inArray(itemRequests.id, ids));
      return rows.map(withLegacyItemRequestDefaults);
    } catch (legacyErr) {
      if (!isMissingOutsidePurchaseReceiptImageUrlColumnError(legacyErr)) {
        throw legacyErr;
      }
      const rows = await db
        .select(itemRequestsRowLegacySelectWithoutReceiptImage)
        .from(itemRequests)
        .where(inArray(itemRequests.id, ids));
      return rows.map(withLegacyItemRequestDefaults);
    }
  }
}

export function randomBatchDisplayNumber(): string {
  const suffix = randomBytes(3).toString("hex");
  return `bat${suffix}`;
}

export async function listQuotedActiveItemRequestsForBatching(
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
          eq(itemRequests.status, "quoted"),
          isNull(itemRequests.batchQuoteSessionId)
        )
      )
      .orderBy(desc(itemRequests.createdAt));
  } catch (e) {
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestsRowLegacySelect)
        .from(itemRequests)
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            eq(itemRequests.status, "quoted")
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
            eq(itemRequests.status, "quoted")
          )
        )
        .orderBy(desc(itemRequests.createdAt));
      return rows.map(withLegacyItemRequestDefaults);
    }
  }
}

export async function listBatchSessionsWithDetailsForOwner(
  clerkUserId: string
): Promise<OwnerBatchQuoteSessionBundle[]> {
  try {
    const db = getDb();
    const sessions = await db
      .select()
      .from(batchQuoteSessions)
      .where(eq(batchQuoteSessions.clerkUserId, clerkUserId))
      .orderBy(desc(batchQuoteSessions.createdAt));

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const links = await db
      .select()
      .from(batchQuoteSessionLines)
      .where(inArray(batchQuoteSessionLines.batchQuoteSessionId, sessionIds));

    const requestIds = [...new Set(links.map((l) => l.itemRequestId))];
    const requestsRows = await selectOwnedItemRequestsByIds(
      clerkUserId,
      requestIds
    );

    const requestMap = new Map(requestsRows.map((r) => [r.id, r]));

    const estimates =
      sessionIds.length === 0
        ? []
        : await db
            .select()
            .from(batchQuoteEstimates)
            .where(
              and(
                inArray(batchQuoteEstimates.batchQuoteSessionId, sessionIds),
                isNull(batchQuoteEstimates.voidedAt)
              )
            )
            .orderBy(desc(batchQuoteEstimates.createdAt));

    const estimateBySession = new Map<string, BatchQuoteEstimate>();
    for (const e of estimates) {
      if (!estimateBySession.has(e.batchQuoteSessionId)) {
        estimateBySession.set(e.batchQuoteSessionId, e);
      }
    }

    const statusEventRows =
      sessionIds.length === 0
        ? []
        : await listBatchQuoteSessionStatusEventsForSessions({
            sessionIds,
          });
    const statusEventsBySessionId = new Map<string, BatchQuoteSessionStatusEvent[]>();
    for (const ev of statusEventRows) {
      const sid = ev.batchQuoteSessionId;
      const prev = statusEventsBySessionId.get(sid) ?? [];
      prev.push(ev);
      statusEventsBySessionId.set(sid, prev);
    }

    const linksBySession = new Map<string, BatchQuoteSessionLine[]>();
    for (const l of links) {
      const prev = linksBySession.get(l.batchQuoteSessionId);
      if (prev) prev.push(l);
      else linksBySession.set(l.batchQuoteSessionId, [l]);
    }

    const bundles: OwnerBatchQuoteSessionBundle[] = [];
    for (const session of sessions) {
      const lr = linksBySession.get(session.id) ?? [];
      let reqs: ItemRequest[];

      if (lr.length > 0) {
        reqs = lr
          .map((row) => requestMap.get(row.itemRequestId))
          .filter((r): r is ItemRequest => Boolean(r));
      } else if (
        session.status === "estimated" ||
        session.status === "in_cart" ||
        session.status === "paid_pending_staff_purchase"
      ) {
        const snapshotIds =
          await itemRequestIdsFromBatchEstimateSnapshots(session.id);
        reqs =
          snapshotIds.length === 0
            ? []
            : await selectOwnedItemRequestsByIds(clerkUserId, snapshotIds);
      } else {
        reqs = [];
      }

      reqs.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });

      bundles.push({
        session,
        lineRows: lr,
        requests: reqs,
        latestEstimate: estimateBySession.get(session.id) ?? null,
        statusEvents: statusEventsBySessionId.get(session.id) ?? [],
      });
    }

    return bundles;
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Batch quote schema is not applied (tables or batch_quote_session_id). Run `npm run db:push` / `npm run db:migrate`."
    );
    return [];
  }
}

export type AdminSubmittedBatchBundle = OwnerBatchQuoteSessionBundle & {
  userFullName: string | null;
  userEmail: string | null;
  /**
   * Shopper asked for a revised bundle after staff had already saved a combined estimate
   * (prior estimate rows were voided and the batch returned to the submitted queue).
   */
  isCustomerResend: boolean;
};

async function buildAdminSubmittedBatchBundle(
  session: BatchQuoteSession
): Promise<AdminSubmittedBatchBundle> {
  const db = getDb();
  const [profile] = await db
    .select({
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.clerkUserId, session.clerkUserId))
    .limit(1);

  const links = await db
    .select()
    .from(batchQuoteSessionLines)
    .where(eq(batchQuoteSessionLines.batchQuoteSessionId, session.id));

  const requestIds = links.map((l) => l.itemRequestId);
  const reqs =
    requestIds.length === 0
      ? []
      : await selectItemRequestsByIds(requestIds);

  const estimateRows = await db
    .select()
    .from(batchQuoteEstimates)
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, session.id),
        isNull(batchQuoteEstimates.voidedAt)
      )
    )
    .orderBy(desc(batchQuoteEstimates.createdAt))
    .limit(1);
  const latestEstimate = estimateRows[0] ?? null;

  const voidedCountRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(batchQuoteEstimates)
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, session.id),
        isNotNull(batchQuoteEstimates.voidedAt)
      )
    );
  const voidedEstimateCount = Number(voidedCountRows[0]?.n ?? 0);

  const statusEvents = await listBatchQuoteSessionStatusEventsForSessions({
    sessionIds: [session.id],
  });

  return {
    session,
    lineRows: links,
    requests: reqs,
    latestEstimate,
    statusEvents,
    userFullName: profile?.fullName ?? null,
    userEmail: profile?.email ?? null,
    isCustomerResend: voidedEstimateCount > 0,
  };
}

export async function listSubmittedBatchSessionsForAdmin(): Promise<
  AdminSubmittedBatchBundle[]
> {
  try {
    const db = getDb();
    const sessions = await db
      .select()
      .from(batchQuoteSessions)
      .where(eq(batchQuoteSessions.status, "submitted"))
      .orderBy(desc(batchQuoteSessions.createdAt));

    return await Promise.all(
      sessions.map((session) => buildAdminSubmittedBatchBundle(session))
    );
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Batch quote schema is not applied (tables or batch_quote_session_id). Run `npm run db:push` / `npm run db:migrate`."
    );
    return [];
  }
}

export type AdminSubmittedBatchListPage = {
  bundles: AdminSubmittedBatchBundle[];
  totalCount: number;
};

export async function listSubmittedBatchSessionsForAdminPage(
  opts: AdminSubmittedBatchListQuery
): Promise<AdminSubmittedBatchListPage> {
  try {
    const db = getDb();
    const offset = (opts.page - 1) * opts.pageSize;
    const term = opts.q.trim();
    const pattern = term ? `%${term}%` : null;

    const searchClause =
      pattern !== null
        ? or(
            ilike(batchQuoteSessions.batchNumber, pattern),
            ilike(batchQuoteSessions.siteKey, pattern),
            ilike(batchQuoteSessions.clerkUserId, pattern),
            ilike(profiles.fullName, pattern),
            ilike(profiles.email, pattern)
          )
        : undefined;

    const whereExpr =
      searchClause !== undefined
        ? and(eq(batchQuoteSessions.status, "submitted"), searchClause)
        : eq(batchQuoteSessions.status, "submitted");

    const dirFn = opts.dir === "asc" ? asc : desc;
    let orderExpr;
    switch (opts.sort) {
      case "batch":
        orderExpr = dirFn(batchQuoteSessions.batchNumber);
        break;
      case "site":
        orderExpr = dirFn(batchQuoteSessions.siteKey);
        break;
      case "customer":
        orderExpr = dirFn(
          sql<string>`coalesce(${profiles.fullName}, ${profiles.email}, ${batchQuoteSessions.clerkUserId})`
        );
        break;
      case "lines":
        orderExpr = dirFn(
          sql<number>`(select count(*)::int from ${batchQuoteSessionLines} where ${batchQuoteSessionLines.batchQuoteSessionId} = ${batchQuoteSessions.id})`
        );
        break;
      case "submitted":
      default:
        orderExpr = dirFn(
          sql<string>`coalesce(${batchQuoteSessions.submittedAt}, ${batchQuoteSessions.createdAt})`
        );
        break;
    }

    const [countRow] = await db
      .select({
        n: sql<number>`count(distinct ${batchQuoteSessions.id})::int`,
      })
      .from(batchQuoteSessions)
      .leftJoin(profiles, eq(batchQuoteSessions.clerkUserId, profiles.clerkUserId))
      .where(whereExpr);

    const totalCount = countRow?.n ?? 0;

    const rows = await db
      .select({ session: batchQuoteSessions })
      .from(batchQuoteSessions)
      .leftJoin(profiles, eq(batchQuoteSessions.clerkUserId, profiles.clerkUserId))
      .where(whereExpr)
      .orderBy(orderExpr)
      .limit(opts.pageSize)
      .offset(offset);

    const bundles = await Promise.all(
      rows.map((row) => buildAdminSubmittedBatchBundle(row.session))
    );

    return { bundles, totalCount };
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Batch quote schema is not applied (tables or batch_quote_session_id). Run `npm run db:push` / `npm run db:migrate`."
    );
    return { bundles: [], totalCount: 0 };
  }
}

export async function listEstimatedBatchBundlesForQuoteHistoryAdmin(): Promise<
  AdminSubmittedBatchBundle[]
> {
  try {
    const db = getDb();
    const sessions = await db
      .select()
      .from(batchQuoteSessions)
      .where(
        inArray(batchQuoteSessions.status, [
          "estimated",
          "in_cart",
          "paid_pending_staff_purchase",
        ]),
      )
      .orderBy(desc(batchQuoteSessions.createdAt));

    const sesIds = sessions.map((s) => s.id);
    const allStatusEvents =
      sesIds.length === 0
        ? []
        : await listBatchQuoteSessionStatusEventsForSessions({
            sessionIds: sesIds,
          });
    const statusEventsMap = new Map<string, BatchQuoteSessionStatusEvent[]>();
    for (const ev of allStatusEvents) {
      const sid = ev.batchQuoteSessionId;
      const prev = statusEventsMap.get(sid) ?? [];
      prev.push(ev);
      statusEventsMap.set(sid, prev);
    }

    const rows: AdminSubmittedBatchBundle[] = [];
    for (const session of sessions) {
      const [profile] = await db
        .select({
          fullName: profiles.fullName,
          email: profiles.email,
        })
        .from(profiles)
        .where(eq(profiles.clerkUserId, session.clerkUserId))
        .limit(1);

      const links = await db
        .select()
        .from(batchQuoteSessionLines)
        .where(eq(batchQuoteSessionLines.batchQuoteSessionId, session.id));

      const reqs = await listItemRequestsForBatchSession(session.id);

      const estimateRows = await db
        .select()
        .from(batchQuoteEstimates)
        .where(
          and(
            eq(batchQuoteEstimates.batchQuoteSessionId, session.id),
            isNull(batchQuoteEstimates.voidedAt)
          )
        )
        .orderBy(desc(batchQuoteEstimates.createdAt))
        .limit(1);
      const latestEstimate = estimateRows[0] ?? null;
      if (!latestEstimate) continue;

      const voidedCountRows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(batchQuoteEstimates)
        .where(
          and(
            eq(batchQuoteEstimates.batchQuoteSessionId, session.id),
            isNotNull(batchQuoteEstimates.voidedAt)
          )
        );
      const voidedEstimateCount = Number(voidedCountRows[0]?.n ?? 0);

      rows.push({
        session,
        lineRows: links,
        requests: reqs,
        latestEstimate,
        statusEvents: statusEventsMap.get(session.id) ?? [],
        userFullName: profile?.fullName ?? null,
        userEmail: profile?.email ?? null,
        isCustomerResend: voidedEstimateCount > 0,
      });
    }

    return rows;
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Batch quote schema is not applied (tables or batch_quote_session_id). Run `npm run db:push` / `npm run db:migrate`."
    );
    return [];
  }
}

export async function collectLatestQuotesForRequests(
  requestIds: string[]
): Promise<Map<string, ItemQuote>> {
  const map = new Map<string, ItemQuote>();
  for (const id of requestIds) {
    let quote = await getLatestQuoteForItemRequest(id);
    if (!quote) {
      quote = await restoreOrphanQuotedItemRequestQuote(id);
    }
    if (quote) map.set(id, quote);
  }
  return map;
}

/**
 * Accepted checkout batch estimate per session (cart acceptance id, else latest non-voided).
 * Used on admin paid-order views where the batch was already checked out.
 */
export async function mapCheckoutBatchEstimatesBySessionIds(
  sessionIds: string[],
): Promise<Map<string, BatchQuoteEstimate>> {
  const unique = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, BatchQuoteEstimate>();
  if (unique.length === 0) return out;

  const db = getDb();
  const sessions = await db
    .select({
      id: batchQuoteSessions.id,
      cartAcceptanceAcceptedEstimateId:
        batchQuoteSessions.cartAcceptanceAcceptedEstimateId,
    })
    .from(batchQuoteSessions)
    .where(inArray(batchQuoteSessions.id, unique));

  const preferredIds = [
    ...new Set(
      sessions
        .map((s) => s.cartAcceptanceAcceptedEstimateId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const estimateById = new Map<string, BatchQuoteEstimate>();
  if (preferredIds.length > 0) {
    const preferredRows = await db
      .select()
      .from(batchQuoteEstimates)
      .where(
        and(
          inArray(batchQuoteEstimates.id, preferredIds),
          isNull(batchQuoteEstimates.voidedAt),
        ),
      );
    for (const row of preferredRows) {
      estimateById.set(row.id, row);
    }
  }

  const sessionIdsNeedingFallback: string[] = [];
  for (const session of sessions) {
    const preferredId = session.cartAcceptanceAcceptedEstimateId;
    if (!preferredId) {
      sessionIdsNeedingFallback.push(session.id);
      continue;
    }
    const row = estimateById.get(preferredId);
    if (
      !row ||
      row.batchQuoteSessionId !== session.id
    ) {
      sessionIdsNeedingFallback.push(session.id);
    } else {
      out.set(session.id, row);
    }
  }

  await Promise.all(
    sessionIdsNeedingFallback.map(async (sessionId) => {
      const [latest] = await db
        .select()
        .from(batchQuoteEstimates)
        .where(
          and(
            eq(batchQuoteEstimates.batchQuoteSessionId, sessionId),
            isNull(batchQuoteEstimates.voidedAt),
          ),
        )
        .orderBy(desc(batchQuoteEstimates.createdAt))
        .limit(1);
      if (latest) out.set(sessionId, latest);
    }),
  );

  return out;
}

export type BatchTotalsFromQuotes = {
  batchMerchandiseTotalCents: number;
  serviceHandlingTotalCents: number;
  batchShippingTotalCents: number;
  batchSaleTaxTotalCents: number;
};

export function sumBatchTotalsFromQuotes(quotes: ItemQuote[]): BatchTotalsFromQuotes {
  let batchMerchandiseTotalCents = 0;
  let serviceHandlingTotalCents = 0;
  let batchShippingTotalCents = 0;
  let batchSaleTaxTotalCents = 0;
  for (const q of quotes) {
    batchMerchandiseTotalCents += q.itemCost;
    serviceHandlingTotalCents += q.serviceFee;
    batchShippingTotalCents += q.estimatedShipping;
    batchSaleTaxTotalCents += lineSaleTaxCentsFromQuote(q);
  }
  return {
    batchMerchandiseTotalCents,
    serviceHandlingTotalCents,
    batchShippingTotalCents,
    batchSaleTaxTotalCents,
  };
}

/**
 * Before attaching items to a new draft:
 * - Drop stale **`draft`** junction rows (and optionally dissolve empty drafts).
 * - **Repair** rows where `item_requests.batch_quote_session_id` is `NULL` but a
 *   `batch_quote_session_lines` row still links the item to a **submitted** or
 *   **estimated** session (unique `item_request_id` would otherwise block `INSERT`).
 */
async function reconcileOwnedItemsForFreshBatchAttachment(
  clerkUserId: string,
  itemRequestIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(itemRequestIds)];
  if (uniqueIds.length === 0) return;

  const db = getDb();
  try {
    const staleDraftLines = await db
      .select({
        lineId: batchQuoteSessionLines.id,
        sid: batchQuoteSessionLines.batchQuoteSessionId,
      })
      .from(batchQuoteSessionLines)
      .innerJoin(
        batchQuoteSessions,
        eq(batchQuoteSessions.id, batchQuoteSessionLines.batchQuoteSessionId)
      )
      .where(
        and(
          inArray(batchQuoteSessionLines.itemRequestId, uniqueIds),
          eq(batchQuoteSessions.clerkUserId, clerkUserId),
          eq(batchQuoteSessions.status, "draft")
        )
      );

    if (staleDraftLines.length > 0) {
      const touchedDraftSessionIds = [
        ...new Set(staleDraftLines.map((r) => r.sid)),
      ];
      const lineIds = staleDraftLines.map((r) => r.lineId);

      await db
        .delete(batchQuoteSessionLines)
        .where(inArray(batchQuoteSessionLines.id, lineIds));

      await db
        .update(itemRequests)
        .set({ batchQuoteSessionId: null })
        .where(
          and(
            eq(itemRequests.clerkUserId, clerkUserId),
            inArray(itemRequests.id, uniqueIds),
            inArray(itemRequests.batchQuoteSessionId, touchedDraftSessionIds)
          )
        );

      for (const sid of touchedDraftSessionIds) {
        const remaining = await db
          .select({ id: batchQuoteSessionLines.id })
          .from(batchQuoteSessionLines)
          .where(eq(batchQuoteSessionLines.batchQuoteSessionId, sid))
          .limit(1);

        if (remaining.length === 0) {
          await db
            .delete(batchQuoteSessions)
            .where(
              and(
                eq(batchQuoteSessions.id, sid),
                eq(batchQuoteSessions.clerkUserId, clerkUserId),
                eq(batchQuoteSessions.status, "draft")
              )
            );
        }
      }
    }

    const inconsistent = await db
      .select({
        itemId: batchQuoteSessionLines.itemRequestId,
        sid: batchQuoteSessionLines.batchQuoteSessionId,
      })
      .from(batchQuoteSessionLines)
      .innerJoin(
        itemRequests,
        eq(itemRequests.id, batchQuoteSessionLines.itemRequestId)
      )
      .innerJoin(
        batchQuoteSessions,
        eq(batchQuoteSessions.id, batchQuoteSessionLines.batchQuoteSessionId)
      )
      .where(
        and(
          inArray(batchQuoteSessionLines.itemRequestId, uniqueIds),
          eq(itemRequests.clerkUserId, clerkUserId),
          isNull(itemRequests.batchQuoteSessionId),
          ne(batchQuoteSessions.status, "draft")
        )
      );

    for (const row of inconsistent) {
      await db
        .update(itemRequests)
        .set({ batchQuoteSessionId: row.sid })
        .where(
          and(
            eq(itemRequests.id, row.itemId),
            eq(itemRequests.clerkUserId, clerkUserId)
          )
        );
    }
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Skipping batch line reconciliation; batch schema not applied."
    );
  }
}

export async function createDraftBatchSessionForOwner(params: {
  clerkUserId: string;
  itemRequestIds: string[];
}): Promise<BatchQuoteSession> {
  const { clerkUserId, itemRequestIds } = params;

  await reconcileOwnedItemsForFreshBatchAttachment(clerkUserId, itemRequestIds);

  const unbatchedQuoted = await listQuotedActiveItemRequestsForBatching(
    clerkUserId
  );
  const chk = validateQuotedFullSiteSelection(unbatchedQuoted, itemRequestIds);
  if (!chk.ok) throw new Error(chk.message);

  const db = getDb();

  for (let attempt = 0; attempt < 5; attempt++) {
    const batchNumber = randomBatchDisplayNumber();
    try {
      const [session] = await db
        .insert(batchQuoteSessions)
        .values({
          clerkUserId,
          batchNumber,
          siteKey: chk.siteKey,
          status: "draft",
        })
        .returning();
      if (!session) throw new Error("Batch session failed.");

      const lineValues = itemRequestIds.map((itemRequestId) => ({
        batchQuoteSessionId: session.id,
        itemRequestId,
      }));

      try {
        await db.insert(batchQuoteSessionLines).values(lineValues);
      } catch (lineErr) {
        await db
          .delete(batchQuoteSessions)
          .where(eq(batchQuoteSessions.id, session.id));
        throw lineErr;
      }

      try {
        await db
          .update(itemRequests)
          .set({ batchQuoteSessionId: session.id })
          .where(
            and(
              eq(itemRequests.clerkUserId, clerkUserId),
              inArray(itemRequests.id, itemRequestIds)
            )
          );
      } catch (updErr) {
        await db
          .delete(batchQuoteSessionLines)
          .where(eq(batchQuoteSessionLines.batchQuoteSessionId, session.id));
        await db
          .delete(batchQuoteSessions)
          .where(eq(batchQuoteSessions.id, session.id));
        throw updErr;
      }

      return session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const code =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        typeof (e as { code: unknown }).code === "string"
          ? (e as { code: string }).code
          : "";
      const low = msg.toLowerCase();
      if (code === "23505" && low.includes("batch_number")) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not assign a batch number.");
}

async function captureBatchStaffSubmissionSnapshotsForAudit(
  sessionId: string
): Promise<void> {
  const requests = await listItemRequestsForBatchSession(sessionId);
  if (requests.length === 0) return;
  for (const req of requests) {
    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "batch_request_submitted_to_staff",
      batchQuoteSessionId: sessionId,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
  }
}

export async function submitDraftBatchSessionForOwner(params: {
  sessionId: string;
  clerkUserId: string;
}): Promise<void> {
  const { sessionId, clerkUserId } = params;
  const db = getDb();
  const submittedAt = new Date().toISOString();

  const updated = await db
    .update(batchQuoteSessions)
    .set({
      status: "submitted",
      submittedAt,
    })
    .where(
      and(
        eq(batchQuoteSessions.id, sessionId),
        eq(batchQuoteSessions.clerkUserId, clerkUserId),
        eq(batchQuoteSessions.status, "draft")
      )
    )
    .returning({ id: batchQuoteSessions.id });

  if (updated.length > 0) {
    await captureBatchStaffSubmissionSnapshotsForAudit(sessionId);

    const [sessionRow] = await db
      .select()
      .from(batchQuoteSessions)
      .where(eq(batchQuoteSessions.id, sessionId))
      .limit(1);

    const lineRequests = sessionRow
      ? await listItemRequestsForBatchSession(sessionId)
      : [];

    await appendBatchQuoteSessionStatusEvent({
      batchQuoteSessionId: sessionId,
      clerkUserId,
      kind: "new_batch_request",
      detail: sessionRow
        ? {
            snapshot: buildBatchQuoteHistorySnapshot({
              kind: "new_batch_request",
              session: sessionRow,
              requests: lineRequests,
              estimate: null,
            }),
          }
        : undefined,
    });

    await notifyAdminsOfBatchQuoteSubmitted(sessionId, clerkUserId);
    return;
  }

  const [row] = await db
    .select({ id: batchQuoteSessions.id, status: batchQuoteSessions.status })
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, sessionId),
        eq(batchQuoteSessions.clerkUserId, clerkUserId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Batch not found.");
  throw new Error("This batch cannot be submitted now.");
}

export async function voidActiveEstimatesForSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(batchQuoteEstimates)
    .set({ voidedAt: new Date().toISOString() })
    .where(
      and(
        eq(batchQuoteEstimates.batchQuoteSessionId, sessionId),
        isNull(batchQuoteEstimates.voidedAt)
      )
    );
}

export async function insertBatchEstimateRow(params: {
  sessionId: string;
  batchMerchandiseTotalCents: number;
  siteMerchandiseTotalCents: number;
  itemDiscountCents: number;
  serviceHandlingTotalCents: number;
  batchShippingTotalCents: number;
  siteShippingTotalCents: number;
  shippingDiscountCents: number;
  batchSaleTaxTotalCents: number;
  siteSaleTaxTotalCents: number;
  saleTaxDiscountCents: number;
  subtotalCents: number;
  recordedByClerkUserId?: string | null;
}): Promise<BatchQuoteEstimate> {
  const db = getDb();
  const [row] = await db
    .insert(batchQuoteEstimates)
    .values({
      batchQuoteSessionId: params.sessionId,
      batchMerchandiseTotalCents: params.batchMerchandiseTotalCents,
      siteMerchandiseTotalCents: params.siteMerchandiseTotalCents,
      itemDiscountCents: params.itemDiscountCents,
      serviceHandlingTotalCents: params.serviceHandlingTotalCents,
      batchShippingTotalCents: params.batchShippingTotalCents,
      siteShippingTotalCents: params.siteShippingTotalCents,
      shippingDiscountCents: params.shippingDiscountCents,
      batchSaleTaxTotalCents: params.batchSaleTaxTotalCents,
      siteSaleTaxTotalCents: params.siteSaleTaxTotalCents,
      saleTaxDiscountCents: params.saleTaxDiscountCents,
      subtotalCents: params.subtotalCents,
      recordedByClerkUserId: params.recordedByClerkUserId?.trim() || null,
    })
    .returning();
  if (!row) throw new Error("Batch estimate insert failed.");
  return row;
}

export async function markSessionEstimated(
  sessionId: string,
  latestEstimate: BatchQuoteEstimate,
): Promise<void> {
  const db = getDb();
  const [before] = await db
    .select()
    .from(batchQuoteSessions)
    .where(eq(batchQuoteSessions.id, sessionId))
    .limit(1);

  if (!before) return;

  const lineRequests = await listItemRequestsForBatchSession(sessionId);

  await db
    .update(batchQuoteSessions)
    .set({ status: "estimated" })
    .where(eq(batchQuoteSessions.id, sessionId));

  const [afterSession] = await db
    .select()
    .from(batchQuoteSessions)
    .where(eq(batchQuoteSessions.id, sessionId))
    .limit(1);

  if (afterSession) {
    await appendBatchQuoteSessionStatusEvent({
      batchQuoteSessionId: sessionId,
      clerkUserId: before.clerkUserId,
      kind: "quoted_batch",
      detail: {
        snapshot: buildBatchQuoteHistorySnapshot({
          kind: "quoted_batch",
          session: afterSession,
          requests: lineRequests,
          estimate: latestEstimate,
        }),
      },
    });

    await recordBatchEstimateReadyActivity({
      clerkUserId: before.clerkUserId,
      batchSessionId: sessionId,
      batchNumber: before.batchNumber,
      lineCount: lineRequests.length,
    });
  }
}

export async function detachItemRequestsFromBatchSession(
  sessionId: string
): Promise<void> {
  const db = getDb();
  await db
    .update(itemRequests)
    .set({ batchQuoteSessionId: null })
    .where(eq(itemRequests.batchQuoteSessionId, sessionId));
}

/**
 * Drops junction rows for lines that cannot be re-submitted as a bundled quote:
 * withdrawn/rejected, plus `approved` (already moved to cart) so revisions only include
 * still-quoted storefront lines.
 */
async function pruneIneligibleLinesForBatchRevision(params: {
  sessionId: string;
  clerkUserId: string;
}): Promise<void> {
  const requests = await listItemRequestsForBatchSession(params.sessionId);
  const removeIds = requests
    .filter(
      (r) =>
        r.clerkUserId === params.clerkUserId &&
        (r.status === "withdrawn" ||
          r.status === "rejected" ||
          r.status === "approved")
    )
    .map((r) => r.id);
  if (removeIds.length === 0) return;
  const db = getDb();
  await db
    .delete(batchQuoteSessionLines)
    .where(
      and(
        eq(batchQuoteSessionLines.batchQuoteSessionId, params.sessionId),
        inArray(batchQuoteSessionLines.itemRequestId, removeIds)
      )
    );
}

/** Customer asks staff to re-price the batch — void visible estimate rows and reopen the submission queue. */
export async function requestEstimatedBatchRevisionForOwner(params: {
  clerkUserId: string;
  sessionId: string;
}): Promise<void> {
  const db = getDb();
  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, params.sessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId)
      )
    )
    .limit(1);

  if (!session) {
    throw new Error("Batch not found.");
  }

  if (session.status !== "estimated") {
    throw new Error(
      session.status === "draft"
        ? "Submit this batch before staff can quote it."
        : session.status === "submitted"
          ? "Staff has not saved a batch estimate yet."
          : "This batch cannot request a new estimate now."
    );
  }

  await pruneIneligibleLinesForBatchRevision({
    sessionId: params.sessionId,
    clerkUserId: params.clerkUserId,
  });

  const requests = await listItemRequestsForBatchSession(params.sessionId);
  if (requests.length === 0) {
    throw new Error("This batch has no line items.");
  }

  if (requests.length < 2) {
    throw new Error(
      "Batched quotes need at least two products. After removing withdrawn lines, too few rows remain — start a fresh batch under Products or contact support."
    );
  }

  for (const r of requests) {
    if (r.clerkUserId !== params.clerkUserId) {
      throw new Error("Not found.");
    }
    if (r.status !== "quoted") {
      throw new Error(
        r.status === "pending"
          ? "Every line in this bundle must stay Quoted. One product is Pending—wait until staff publishes its quote, refresh, then request a revised batch estimate."
          : `Every line must be Quoted to request a new bundle estimate (found status: ${r.status}). Refresh the page or contact support.`
      );
    }
  }

  await voidActiveEstimatesForSession(params.sessionId);

  const updated = await db
    .update(batchQuoteSessions)
    .set({ status: "submitted" })
    .where(
      and(
        eq(batchQuoteSessions.id, params.sessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
        eq(batchQuoteSessions.status, "estimated")
      )
    )
    .returning({ id: batchQuoteSessions.id });

  if (updated.length === 0) {
    throw new Error("Could not reopen this batch. Refresh and try again.");
  }

  await captureBatchStaffSubmissionSnapshotsForAudit(params.sessionId);

  const [sessionAfter] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, params.sessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
      ),
    )
    .limit(1);

  const revisionRequests = sessionAfter
    ? await listItemRequestsForBatchSession(params.sessionId)
    : [];

  await appendBatchQuoteSessionStatusEvent({
    batchQuoteSessionId: params.sessionId,
    clerkUserId: params.clerkUserId,
    kind: "revision_reopened",
    detail: sessionAfter
      ? {
          snapshot: buildBatchQuoteHistorySnapshot({
            kind: "revision_reopened",
            session: sessionAfter,
            requests: revisionRequests,
            estimate: null,
          }),
        }
      : undefined,
  });
}

export type WithdrawEstimatedBatchQuoteOutcome =
  | { outcome: "needs_ack"; emptyBatch: boolean; missingQuotesForProducts: string[] }
  | { outcome: "completed" };

/**
 * Deletes an **`estimated`** batch session owned by `clerkUserId` when it has not been
 * accepted into the cart. Line items normally already sit on Products (`batch_quote_session_id`
 * null); any stragglers are detached before delete. Cascades junction rows + estimate rows.
 */
export async function withdrawEstimatedBatchQuoteSessionForOwner(params: {
  clerkUserId: string;
  batchSessionId: string;
  acknowledgeWithdrawalAnomalies: boolean;
}): Promise<WithdrawEstimatedBatchQuoteOutcome> {
  const db = getDb();
  const batchSessionId = params.batchSessionId;

  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId)
      )
    )
    .limit(1);

  if (!session) {
    throw new Error("Batch not found.");
  }
  if (session.status !== "estimated") {
    throw new Error(
      session.status === "draft"
        ? "Only quoted batch estimates can be withdrawn from this tab."
        : session.status === "submitted"
          ? "Staff is still preparing this batch—you cannot withdraw it yet here."
          : "This bundle cannot be withdrawn now. Refresh and try again."
    );
  }
  if (session.cartAcceptanceAcceptedAt) {
    throw new Error(
      "Remove this bundle from your cart before withdrawing this batch estimate."
    );
  }

  const linkedRequests = await listItemRequestsForBatchSession(batchSessionId);
  const ids = linkedRequests
    .filter((r) => r.clerkUserId === params.clerkUserId)
    .map((r) => r.id);

  const quoteMap = await collectLatestQuotesForRequests(ids);
  const missingQuotesForProducts = linkedRequests
    .filter((r) => r.clerkUserId === params.clerkUserId && !quoteMap.has(r.id))
    .map((r) => r.productName?.trim() || "Unnamed product");

  const emptyBatch = ids.length === 0;
  const hasAnomaly =
    emptyBatch ||
    missingQuotesForProducts.length > 0;

  if (hasAnomaly && !params.acknowledgeWithdrawalAnomalies) {
    return {
      outcome: "needs_ack",
      emptyBatch,
      missingQuotesForProducts,
    };
  }

  // Single DELETE — neon-http driver has no `.transaction()` support.
  // `item_requests.batch_quote_session_id` uses ON DELETE SET NULL; junction + estimates CASCADE.
  const deleted = await db
    .delete(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
        eq(batchQuoteSessions.status, "estimated"),
        isNull(batchQuoteSessions.cartAcceptanceAcceptedAt)
      )
    )
    .returning({ id: batchQuoteSessions.id });

  if (deleted.length === 0) {
    throw new Error("Could not withdraw this batch. Refresh and try again.");
  }

  return { outcome: "completed" };
}

/**
 * Withdraws a **`submitted`** ("New batch request") batch owned by `clerkUserId`
 * before staff have saved an estimate. Detaches every linked line back to Products
 * (`batch_quote_session_id` → null) so each product returns as an individual quoted
 * request, then deletes the session. Deleting removes it from the admin submitted
 * queue (revoking the staff batch-estimate task); junction/estimate/status-event rows
 * cascade, while audit line snapshots persist via FK `SET NULL`.
 */
export async function withdrawSubmittedBatchQuoteSessionForOwner(params: {
  clerkUserId: string;
  batchSessionId: string;
}): Promise<{ returnedCount: number }> {
  const db = getDb();
  const batchSessionId = params.batchSessionId;

  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId)
      )
    )
    .limit(1);

  if (!session) {
    throw new Error("Batch not found.");
  }
  if (session.status !== "submitted") {
    throw new Error(
      session.status === "draft"
        ? "Submit this batch first, or remove its products from the draft instead."
        : session.status === "estimated"
          ? "Staff already saved an estimate—use Withdraw batch on the quoted bundle instead."
          : "This batch request can no longer be withdrawn. Refresh and try again."
    );
  }

  const linkedRequests = await listItemRequestsForBatchSession(batchSessionId);
  const returnedCount = linkedRequests.filter(
    (r) => r.clerkUserId === params.clerkUserId
  ).length;

  // Detach lines explicitly (FK is ON DELETE SET NULL, but make the intent clear)
  // so they return to Products as individual quoted requests, then delete the session.
  await detachItemRequestsFromBatchSession(batchSessionId);

  const deleted = await db
    .delete(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId),
        eq(batchQuoteSessions.status, "submitted")
      )
    )
    .returning({ id: batchQuoteSessions.id });

  if (deleted.length === 0) {
    throw new Error("Could not withdraw this batch request. Refresh and try again.");
  }

  return { returnedCount };
}

/**
 * Drops selected draft-batch lines back onto Products (clears FK + removes link rows).
 * If fewer than two products remain, deletes the draft session so the last lines return
 * to Products as well — batched quoting requires two or more products.
 *
 * Throws on ownership / status / linkage violations.
 */
export async function removeItemRequestsFromOwnerDraftBatchSession(params: {
  clerkUserId: string;
  batchSessionId: string;
  itemRequestIds: string[];
}): Promise<{ removedCount: number; batchDissolved: boolean }> {
  const db = getDb();
  const batchSessionId = params.batchSessionId;
  const uniqueIds = [...new Set(params.itemRequestIds)];
  if (uniqueIds.length === 0) {
    throw new Error("Select at least one product.");
  }

  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(
      and(
        eq(batchQuoteSessions.id, batchSessionId),
        eq(batchQuoteSessions.clerkUserId, params.clerkUserId)
      )
    )
    .limit(1);

  if (!session) {
    throw new Error("Batch not found.");
  }
  if (session.status !== "draft") {
    throw new Error(
      "Only draft batches can be edited. Submitted batches are already with staff."
    );
  }

  const incomingLinks = await db
    .select()
    .from(batchQuoteSessionLines)
    .where(
      and(
        eq(batchQuoteSessionLines.batchQuoteSessionId, batchSessionId),
        inArray(batchQuoteSessionLines.itemRequestId, uniqueIds)
      )
    );

  if (incomingLinks.length !== uniqueIds.length) {
    throw new Error(
      "One or more selected products could not be found in this draft batch."
    );
  }

  const ownedRequests = await selectOwnedItemRequestsByIds(
    params.clerkUserId,
    uniqueIds
  );
  const ownedOk = uniqueIds.every((id) =>
    ownedRequests.some(
      (r) =>
        r.id === id &&
        r.batchQuoteSessionId === batchSessionId
    )
  );
  if (!ownedOk || ownedRequests.length !== uniqueIds.length) {
    throw new Error("Not found.");
  }

  await db
    .delete(batchQuoteSessionLines)
    .where(
      and(
        eq(batchQuoteSessionLines.batchQuoteSessionId, batchSessionId),
        inArray(batchQuoteSessionLines.itemRequestId, uniqueIds)
      )
    );

  await db
    .update(itemRequests)
    .set({ batchQuoteSessionId: null })
    .where(
      and(
        eq(itemRequests.clerkUserId, params.clerkUserId),
        inArray(itemRequests.id, uniqueIds)
      )
    );

  const linksRemaining = await db
    .select({ id: batchQuoteSessionLines.id })
    .from(batchQuoteSessionLines)
    .where(eq(batchQuoteSessionLines.batchQuoteSessionId, batchSessionId));

  let batchDissolved = false;
  if (linksRemaining.length < 2) {
    await db
      .delete(batchQuoteSessions)
      .where(
        and(
          eq(batchQuoteSessions.id, batchSessionId),
          eq(batchQuoteSessions.status, "draft")
        )
      );
    batchDissolved = true;
  }

  return {
    removedCount: uniqueIds.length,
    batchDissolved,
  };
}

async function itemRequestIdsFromBatchEstimateSnapshots(
  batchQuoteSessionId: string
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      itemRequestId: itemRequestLineSnapshots.itemRequestId,
    })
    .from(itemRequestLineSnapshots)
    .where(
      and(
        eq(itemRequestLineSnapshots.batchQuoteSessionId, batchQuoteSessionId),
        eq(itemRequestLineSnapshots.phase, "batch_estimate_customer_copy")
      )
    );
  return [...new Set(rows.map((r) => r.itemRequestId))];
}

export async function listItemRequestsForBatchSession(
  sessionId: string
): Promise<ItemRequest[]> {
  const db = getDb();
  const links = await db
    .select({ itemRequestId: batchQuoteSessionLines.itemRequestId })
    .from(batchQuoteSessionLines)
    .where(eq(batchQuoteSessionLines.batchQuoteSessionId, sessionId));

  let ids = links.map((r) => r.itemRequestId);
  if (ids.length === 0) {
    ids = await itemRequestIdsFromBatchEstimateSnapshots(sessionId);
  }
  if (ids.length === 0) return [];
  return await selectItemRequestsByIds(ids);
}

export type AdminBatchSubmissionEvent = {
  createdAt: string;
  kind: "initial_submission" | "customer_resend";
};

export type AdminBatchHistoryLinePair = {
  itemRequestId: string;
  submissionSnapshot: ItemRequestLineSnapshot | null;
  estimateAdminSnapshot: ItemRequestLineSnapshot | null;
};

export type AdminBatchHistoryBundle = {
  session: BatchQuoteSession;
  userFullName: string | null;
  userEmail: string | null;
  lines: AdminBatchHistoryLinePair[];
  /** Latest non-voided batch estimate shown to shoppers (derived from revisions). */
  latestEstimate: BatchQuoteEstimate | null;
  /** All estimate rows this session saved (staff edits append; prior rows stay voided), newest first. */
  estimateRevisions: BatchQuoteEstimate[];
  /**
   * Frozen “batch_request_submitted_to_staff” snapshot rounds (initial send + each customer resend),
   * chronologically ordered.
   */
  submissionEvents: AdminBatchSubmissionEvent[];
};

function isRecoverableBatchSnapshotSelectError(e: unknown): boolean {
  if (shouldUseBatchQuoteSchemaFallback(e)) return true;
  return (
    isUndefinedColumnError(e, "batch_quote_session_id") ||
    isUndefinedColumnError(e, "audit_memo")
  );
}

function latestSnapshotsByItemForPhase(
  rows: ItemRequestLineSnapshot[],
  phase: ItemRequestLineSnapshot["phase"]
): Map<string, ItemRequestLineSnapshot> {
  const filtered = rows.filter((r) => r.phase === phase);
  filtered.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const map = new Map<string, ItemRequestLineSnapshot>();
  for (const r of filtered) {
    if (!map.has(r.itemRequestId)) map.set(r.itemRequestId, r);
  }
  return map;
}

function buildBatchHistoryLinePairsForSession(
  sessionId: string,
  sessionSnapshots: ItemRequestLineSnapshot[]
): AdminBatchHistoryLinePair[] {
  const mine = sessionSnapshots.filter((s) => s.batchQuoteSessionId === sessionId);
  const submissionByItem = latestSnapshotsByItemForPhase(mine, "batch_request_submitted_to_staff");
  const estimateByItem = latestSnapshotsByItemForPhase(mine, "batch_estimate_admin_copy");
  const submissionOrdered = [...submissionByItem.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const orderedIds: string[] = [];
  const seen = new Set<string>();

  for (const row of submissionOrdered) {
    if (!seen.has(row.itemRequestId)) {
      orderedIds.push(row.itemRequestId);
      seen.add(row.itemRequestId);
    }
  }
  for (const id of estimateByItem.keys()) {
    if (!seen.has(id)) {
      orderedIds.push(id);
      seen.add(id);
    }
  }

  return orderedIds.map((itemRequestId) => ({
    itemRequestId,
    submissionSnapshot: submissionByItem.get(itemRequestId) ?? null,
    estimateAdminSnapshot: estimateByItem.get(itemRequestId) ?? null,
  }));
}

/** One entry per shopper “send to staff” round (initial batch submit or revision resend). */
function buildSubmissionEventsForSession(
  sessionId: string,
  sessionSnapshots: ItemRequestLineSnapshot[]
): AdminBatchSubmissionEvent[] {
  const mine = sessionSnapshots.filter(
    (s) =>
      s.batchQuoteSessionId === sessionId &&
      s.phase === "batch_request_submitted_to_staff"
  );
  if (mine.length === 0) return [];

  const secondBuckets = [
    ...new Set(
      mine.map((s) => {
        const t = new Date(s.createdAt).getTime();
        return Math.floor(t / 1000) * 1000;
      })
    ),
  ].sort((a, b) => a - b);

  return secondBuckets.map((bucketMs, index) => ({
    createdAt: new Date(bucketMs).toISOString(),
    kind:
      index === 0 ? ("initial_submission" as const) : ("customer_resend" as const),
  }));
}

/** Every submitted or estimated bundle (including pending staff response) with line snapshot pairs for admin history. */
export async function listBatchHistoryForAdmin(): Promise<AdminBatchHistoryBundle[]> {
  try {
    const db = getDb();
    const sessions = await db
      .select()
      .from(batchQuoteSessions)
      .where(ne(batchQuoteSessions.status, "draft"))
      .orderBy(
        desc(
          sql`COALESCE(${batchQuoteSessions.submittedAt}, ${batchQuoteSessions.createdAt})`
        )
      );

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    let snapshotRows: ItemRequestLineSnapshot[] = [];
    try {
      snapshotRows = await db
        .select()
        .from(itemRequestLineSnapshots)
        .where(
          and(
            inArray(itemRequestLineSnapshots.batchQuoteSessionId, sessionIds),
            inArray(itemRequestLineSnapshots.phase, [
              "batch_request_submitted_to_staff",
              "batch_estimate_admin_copy",
            ])
          )
        );
    } catch (e) {
      if (!isRecoverableBatchSnapshotSelectError(e)) throw e;
      snapshotRows = [];
    }

    const allEstimatesRows =
      sessionIds.length === 0
        ? []
        : await db
            .select()
            .from(batchQuoteEstimates)
            .where(inArray(batchQuoteEstimates.batchQuoteSessionId, sessionIds));

    const revisionsBySession = new Map<string, BatchQuoteEstimate[]>();
    for (const row of allEstimatesRows) {
      const sid = row.batchQuoteSessionId;
      const prev = revisionsBySession.get(sid);
      if (prev) prev.push(row);
      else revisionsBySession.set(sid, [row]);
    }
    for (const revs of revisionsBySession.values()) {
      revs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const out: AdminBatchHistoryBundle[] = [];
    for (const session of sessions) {
      const [profile] = await db
        .select({
          fullName: profiles.fullName,
          email: profiles.email,
        })
        .from(profiles)
        .where(eq(profiles.clerkUserId, session.clerkUserId))
        .limit(1);

      const estimateRevisions = revisionsBySession.get(session.id) ?? [];
      const latestEstimate =
        estimateRevisions.find((e) => e.voidedAt == null) ?? null;

      out.push({
        session,
        userFullName: profile?.fullName ?? null,
        userEmail: profile?.email ?? null,
        lines: buildBatchHistoryLinePairsForSession(session.id, snapshotRows),
        latestEstimate,
        estimateRevisions,
        submissionEvents: buildSubmissionEventsForSession(session.id, snapshotRows),
      });
    }

    return out;
  } catch (e) {
    if (!shouldUseBatchQuoteSchemaFallback(e)) throw e;
    console.warn(
      "[Cart2Barrel] Batch quote schema is not applied (tables or batch_quote_session_id). Run `npm run db:push` / `npm run db:migrate`."
    );
    return [];
  }
}

export function auditMemoLinesForBatch(params: {
  batchNumber: string;
  estimateId?: string | null;
  audience: "customer" | "admin";
  batchMerchandiseTotalCents: number;
  siteMerchandiseTotalCents: number;
  itemDiscountCents: number;
  serviceHandlingTotalCents: number;
  batchShippingTotalCents: number;
  siteShippingTotalCents: number;
  shippingDiscountCents: number;
  batchSaleTaxTotalCents: number;
  siteSaleTaxTotalCents: number;
  saleTaxDiscountCents: number;
  subtotalCents: number;
}): string {
  const lines = [
    `Audience: ${params.audience}`,
    params.estimateId ? `Batch estimate row: ${params.estimateId}` : "",
    `Batch ${params.batchNumber}`,
    `Merchandise (batch sum): ${formatUsd(params.batchMerchandiseTotalCents)}`,
    `Site merchandise (customer pays): ${formatUsd(params.siteMerchandiseTotalCents)}`,
    `Item discount: ${formatUsd(params.itemDiscountCents)}`,
    `Service & handling (batch sum): ${formatUsd(params.serviceHandlingTotalCents)}`,
    `Shipping batch total: ${formatUsd(params.batchShippingTotalCents)}`,
    `Site shipping: ${formatUsd(params.siteShippingTotalCents)}`,
    `Shipping discount: ${formatUsd(params.shippingDiscountCents)}`,
    `Batch sale tax: ${formatUsd(params.batchSaleTaxTotalCents)}`,
    `Site sale tax: ${formatUsd(params.siteSaleTaxTotalCents)}`,
    `Sale tax discount: ${formatUsd(params.saleTaxDiscountCents)}`,
    `Subtotal sent to customer: ${formatUsd(params.subtotalCents)}`,
  ];
  return lines.filter(Boolean).join("\n");
}
