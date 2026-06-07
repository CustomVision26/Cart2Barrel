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
import { countOutsidePurchaseIntakesAwaitingPayment } from "@/data/outside-purchase-intake";
import { buildAdminItemRequestGroups } from "@/lib/admin-item-requests-group";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import { filterAdminItemRequestGroups } from "@/lib/admin-customer-filter";
import {
  getClerkSessionGate,
  getClerkUserForAdminData,
} from "@/lib/clerk-session";

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

export type AdminItemRequestsNavState = {
  admin: boolean;
  noData: boolean;
  emptyAsNonAdmin: boolean;
  pendingBatchCount: number;
  quoteHistoryCount: number;
  /** Quoted outside-purchase lines awaiting customer payment. */
  outsidePurchaseCount: number;
  batchQuoteHistoryCount: number;
  batchHistoryCount: number;
};

type AdminItemRequestsBase = {
  user: User | null;
  admin: boolean;
  groups: AdminItemRequestGroup[];
  quoteHistoryGroups: AdminQuoteHistoryGroup[];
  submittedBatchBundles: AdminSubmittedBatchBundle[];
  batchQuoteHistoryBundles: AdminSubmittedBatchBundle[];
  batchHistoryBundles: AdminBatchHistoryBundle[];
  rows: Awaited<ReturnType<typeof listItemRequestsWithProfileForAdmin>>;
  hasActiveQueue: boolean;
  noData: boolean;
  emptyAsNonAdmin: boolean;
};

function collectRequestIds(base: AdminItemRequestsBase): string[] {
  const requestIds = new Set<string>();
  for (const row of base.rows) requestIds.add(row.request.id);
  for (const g of base.quoteHistoryGroups) {
    for (const line of g.lines) {
      requestIds.add(line.request.id);
    }
  }
  for (const bundle of base.submittedBatchBundles) {
    for (const r of bundle.requests) requestIds.add(r.id);
  }
  for (const bundle of base.batchQuoteHistoryBundles) {
    for (const r of bundle.requests) requestIds.add(r.id);
  }
  return [...requestIds];
}

const loadAdminItemRequestsBase = cache(async (): Promise<
  | { ok: false; message: string }
  | { ok: true; base: AdminItemRequestsBase }
> => {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const user = await getClerkUserForAdminData(gate);
  const admin = gate.isAdmin;

  const [
    rows,
    quoteHistoryGroups,
    submittedBatchBundles,
    batchQuoteHistoryBundles,
    batchHistoryBundles,
  ] = await Promise.all([
    listItemRequestsWithProfileForAdmin(user, admin),
    listQuoteHistoryGroupedForAdmin(user, admin),
    listSubmittedBatchSessionsForAdmin(),
    listEstimatedBatchBundlesForQuoteHistoryAdmin(),
    listBatchHistoryForAdmin(),
  ]);

  const groups = buildAdminItemRequestGroups(rows);
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
    ok: true,
    base: {
      user,
      admin,
      groups,
      quoteHistoryGroups,
      submittedBatchBundles,
      batchQuoteHistoryBundles,
      batchHistoryBundles,
      rows,
      hasActiveQueue,
      noData,
      emptyAsNonAdmin,
    },
  };
});

/** Tab counts and empty states — no snapshots or quote maps (fast layout renders). */
export const loadAdminItemRequestsNavState = cache(async (): Promise<
  | { ok: false; message: string }
  | { ok: true; nav: AdminItemRequestsNavState }
> => {
  const result = await loadAdminItemRequestsBase();
  if (!result.ok) {
    return result;
  }

  const { base } = result;
  const outsidePurchaseCount =
    base.admin ? await countOutsidePurchaseIntakesAwaitingPayment() : 0;
  return {
    ok: true,
    nav: {
      admin: base.admin,
      noData: base.noData,
      emptyAsNonAdmin: base.emptyAsNonAdmin,
      pendingBatchCount: base.submittedBatchBundles.length,
      quoteHistoryCount: base.quoteHistoryGroups.length,
      outsidePurchaseCount,
      batchQuoteHistoryCount: base.batchQuoteHistoryBundles.length,
      batchHistoryCount: base.batchHistoryBundles.length,
    },
  };
});

async function enrichWithSnapshotsAndQuotes(
  base: AdminItemRequestsBase,
): Promise<
  Pick<
    AdminItemRequestsPagePayload,
    | "snapshotsByRequestId"
    | "activeQueueLatestQuotesByRequestId"
    | "batchQuoteHistoryLatestQuotesByRequestId"
  >
> {
  const requestIds = collectRequestIds(base);
  const batchHistoryQuoteReqIds = new Set<string>();
  for (const bundle of base.batchQuoteHistoryBundles) {
    for (const r of bundle.requests) batchHistoryQuoteReqIds.add(r.id);
  }
  for (const bundle of base.batchHistoryBundles) {
    for (const line of bundle.lines) {
      batchHistoryQuoteReqIds.add(line.itemRequestId);
    }
  }

  const quotedActiveRequestIds = base.rows
    .filter((row) => row.request.status === "quoted")
    .map((row) => row.request.id);

  const [snapshotRows, batchQuoteHistoryLatestQuotes, activeQueueLatestQuotes] =
    await Promise.all([
      listItemRequestLineSnapshotsByRequestIds(base.user, requestIds, base.admin),
      batchHistoryQuoteReqIds.size === 0
        ? Promise.resolve(new Map<string, ItemQuote>())
        : collectLatestQuotesForRequests([...batchHistoryQuoteReqIds]),
      quotedActiveRequestIds.length === 0
        ? Promise.resolve(new Map<string, ItemQuote>())
        : collectLatestQuotesForRequests(quotedActiveRequestIds),
    ]);

  return {
    snapshotsByRequestId: Object.fromEntries(
      groupItemRequestLineSnapshotsByRequestId(snapshotRows),
    ),
    batchQuoteHistoryLatestQuotesByRequestId: Object.fromEntries(
      batchQuoteHistoryLatestQuotes,
    ),
    activeQueueLatestQuotesByRequestId: Object.fromEntries(activeQueueLatestQuotes),
  };
}

/** Full payload for item-request pages (snapshots + latest quotes). */
export const loadAdminItemRequestsPagePayload = cache(async (): Promise<
  | { ok: false; message: string }
  | { ok: true; payload: AdminItemRequestsPagePayload }
> => {
  const result = await loadAdminItemRequestsBase();
  if (!result.ok) {
    return result;
  }

  const { base } = result;
  const enriched = await enrichWithSnapshotsAndQuotes(base);

  return {
    ok: true,
    payload: {
      user: base.user,
      admin: base.admin,
      groups: base.groups,
      quoteHistoryGroups: base.quoteHistoryGroups,
      submittedBatchBundles: base.submittedBatchBundles,
      batchQuoteHistoryBundles: base.batchQuoteHistoryBundles,
      batchHistoryBundles: base.batchHistoryBundles,
      hasActiveQueue: base.hasActiveQueue,
      noData: base.noData,
      emptyAsNonAdmin: base.emptyAsNonAdmin,
      ...enriched,
    },
  };
});

export type AdminItemRequestsQueuePagePayload = {
  groups: AdminItemRequestGroup[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  activeQueueLatestQuotesByRequestId: Record<string, ItemQuote>;
  hasActiveQueue: boolean;
  noData: boolean;
  emptyAsNonAdmin: boolean;
};

/** Queue table only renders `activeQueueRequests`; drop full account history from the client payload. */
export function slimAdminItemRequestGroupForClient(
  group: AdminItemRequestGroup,
): AdminItemRequestGroup {
  return { ...group, requests: [] };
}

/** Active queue tab — snapshots and quotes scoped to in-flight lines only. */
export const loadAdminItemRequestsQueuePagePayload = cache(
  async (
    clerkUserId?: string | null,
  ): Promise<
    | { ok: false; message: string }
    | { ok: true; payload: AdminItemRequestsQueuePagePayload }
  > => {
    const result = await loadAdminItemRequestsBase();
    if (!result.ok) {
      return result;
    }

    const { base } = result;
    const queueGroups = filterAdminItemRequestGroups(
      base.groups.filter((g) => g.activeQueueCount > 0),
      clerkUserId ?? undefined,
    );

    if (queueGroups.length === 0) {
      return {
        ok: true,
        payload: {
          groups: [],
          snapshotsByRequestId: {},
          activeQueueLatestQuotesByRequestId: {},
          hasActiveQueue: base.hasActiveQueue,
          noData: base.noData,
          emptyAsNonAdmin: base.emptyAsNonAdmin,
        },
      };
    }

    const queueRequestIds = queueGroups.flatMap((g) =>
      g.activeQueueRequests.map((row) => row.request.id),
    );
    const quotedActiveRequestIds = queueGroups.flatMap((g) =>
      g.activeQueueRequests
        .filter((row) => row.request.status === "quoted")
        .map((row) => row.request.id),
    );

    const [snapshotRows, activeQueueLatestQuotes] = await Promise.all([
      listItemRequestLineSnapshotsByRequestIds(
        base.user,
        queueRequestIds,
        base.admin,
      ),
      quotedActiveRequestIds.length === 0
        ? Promise.resolve(new Map<string, ItemQuote>())
        : collectLatestQuotesForRequests(quotedActiveRequestIds),
    ]);

    return {
      ok: true,
      payload: {
        groups: queueGroups.map(slimAdminItemRequestGroupForClient),
        snapshotsByRequestId: Object.fromEntries(
          groupItemRequestLineSnapshotsByRequestId(snapshotRows),
        ),
        activeQueueLatestQuotesByRequestId: Object.fromEntries(
          activeQueueLatestQuotes,
        ),
        hasActiveQueue: base.hasActiveQueue,
        noData: base.noData,
        emptyAsNonAdmin: base.emptyAsNonAdmin,
      },
    };
  },
);
