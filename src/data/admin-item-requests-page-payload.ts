import type { User } from "@clerk/nextjs/server";
import { cache } from "react";

import { listItemRequestsWithProfileForAdmin } from "@/data/admin-item-requests";
import {
  listQuoteHistoryGroupedForAdmin,
  type AdminQuoteHistoryGroup,
} from "@/data/admin-quote-history";
import {
  collectLatestQuotesForRequests,
  listBatchHistoryForAdmin,
  listEstimatedBatchBundlesForQuoteHistoryAdmin,
  listSubmittedBatchSessionsForAdmin,
  type AdminBatchHistoryBundle,
  type AdminSubmittedBatchBundle,
} from "@/data/batch-quote-sessions";
import {
  groupItemRequestLineSnapshotsByRequestId,
  listItemRequestLineSnapshotsByRequestIds,
} from "@/data/item-request-line-snapshots";
import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { buildAdminItemRequestGroups } from "@/lib/admin-item-requests-group";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type AdminItemRequestsPagePayload = {
  user: User | null;
  admin: boolean;
  groups: AdminItemRequestGroup[];
  quoteHistoryGroups: AdminQuoteHistoryGroup[];
  submittedBatchBundles: AdminSubmittedBatchBundle[];
  batchQuoteHistoryBundles: AdminSubmittedBatchBundle[];
  batchHistoryBundles: AdminBatchHistoryBundle[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  /** Latest operational quotes for quoted rows in the active ops queue. */
  activeQueueLatestQuotesByRequestId: Record<string, ItemQuote>;
  /** Latest item quotes keyed by request id — used for combined batch estimate line previews. */
  batchQuoteHistoryLatestQuotesByRequestId: Record<string, ItemQuote>;
  hasActiveQueue: boolean;
  noData: boolean;
  emptyAsNonAdmin: boolean;
};

async function computePayload(user: User | null): Promise<AdminItemRequestsPagePayload> {
  const admin = isClerkAdmin(user);
  const rows = await listItemRequestsWithProfileForAdmin(user);
  const groups = buildAdminItemRequestGroups(rows);
  const quoteHistoryGroups = await listQuoteHistoryGroupedForAdmin(user);
  const submittedBatchBundles = await listSubmittedBatchSessionsForAdmin();
  const batchQuoteHistoryBundles =
    await listEstimatedBatchBundlesForQuoteHistoryAdmin();
  const batchHistoryBundles = await listBatchHistoryForAdmin();
  const requestIds = new Set<string>();
  for (const row of rows) requestIds.add(row.request.id);
  for (const g of quoteHistoryGroups) {
    for (const line of g.lines) {
      requestIds.add(line.request.id);
    }
  }
  for (const bundle of submittedBatchBundles) {
    for (const r of bundle.requests) requestIds.add(r.id);
  }
  for (const bundle of batchQuoteHistoryBundles) {
    for (const r of bundle.requests) requestIds.add(r.id);
  }
  const batchHistoryQuoteReqIds = new Set<string>();
  for (const bundle of batchQuoteHistoryBundles) {
    for (const r of bundle.requests) batchHistoryQuoteReqIds.add(r.id);
  }
  const batchQuoteHistoryLatestQuotes =
    batchHistoryQuoteReqIds.size === 0
      ? new Map<string, ItemQuote>()
      : await collectLatestQuotesForRequests([...batchHistoryQuoteReqIds]);
  const batchQuoteHistoryLatestQuotesByRequestId = Object.fromEntries(
    batchQuoteHistoryLatestQuotes,
  );

  const quotedActiveRequestIds = rows
    .filter((row) => row.request.status === "quoted")
    .map((row) => row.request.id);
  const activeQueueLatestQuotes =
    quotedActiveRequestIds.length === 0
      ? new Map<string, ItemQuote>()
      : await collectLatestQuotesForRequests(quotedActiveRequestIds);
  const activeQueueLatestQuotesByRequestId = Object.fromEntries(
    activeQueueLatestQuotes,
  );

  const snapshotRows = await listItemRequestLineSnapshotsByRequestIds(user, [
    ...requestIds,
  ]);
  const snapshotsByRequestId = Object.fromEntries(
    groupItemRequestLineSnapshotsByRequestId(snapshotRows)
  );
  const hasActiveQueue = groups.some((g) => g.activeQueueCount > 0);

  const emptyAsNonAdmin = !admin;
  const noData =
    emptyAsNonAdmin ||
    (rows.length === 0 &&
      quoteHistoryGroups.length === 0 &&
      submittedBatchBundles.length === 0 &&
      batchQuoteHistoryBundles.length === 0 &&
      batchHistoryBundles.length === 0);

  return {
    user,
    admin,
    groups,
    quoteHistoryGroups,
    submittedBatchBundles,
    batchQuoteHistoryBundles,
    batchHistoryBundles,
    snapshotsByRequestId,
    activeQueueLatestQuotesByRequestId,
    batchQuoteHistoryLatestQuotesByRequestId,
    hasActiveQueue,
    noData,
    emptyAsNonAdmin,
  };
}

/** One payload per incoming request — safe to call from layout and nested routes. */
export const loadAdminItemRequestsPagePayload = cache(async (): Promise<
  | { ok: false; message: string }
  | { ok: true; payload: AdminItemRequestsPagePayload }
> => {
  const cu = await safeCurrentUser();
  if (!cu.ok) {
    return { ok: false, message: cu.message };
  }
  const payload = await computePayload(cu.user);
  return { ok: true, payload };
});
