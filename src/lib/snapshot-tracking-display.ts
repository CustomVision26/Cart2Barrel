import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { isDuplicateFrozenCopySnapshotSummary } from "@/lib/audit-snapshot-duplicate-copy";
import { auditSnapshotChangeSummary } from "@/lib/item-request-line-audit-status";
import { itemRequestLineSnapshotPhaseLabel } from "@/lib/item-request-line-snapshot-phase-label";

/** Customer-facing copy is a duplicate of the admin batch estimate row. */
export function shouldHideSnapshotFromProductTracking(
  phase: ItemRequestLineSnapshot["phase"],
): boolean {
  return phase === "batch_estimate_customer_copy";
}

/** Chronologically prior snapshot row (full history, not display-filtered). */
export function chronologicalPreviousSnapshot(
  snap: ItemRequestLineSnapshot,
  snapshots: ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot | null {
  const index = snapshots.findIndex((s) => s.id === snap.id);
  if (index <= 0) return null;
  return snapshots[index - 1] ?? null;
}

function dedupeLatestBatchSubmissionSnapshots(
  snapshots: ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot[] {
  const latestBySession = new Map<string, ItemRequestLineSnapshot>();
  for (const snap of snapshots) {
    if (
      snap.phase === "batch_request_submitted_to_staff" &&
      snap.batchQuoteSessionId
    ) {
      latestBySession.set(snap.batchQuoteSessionId, snap);
    }
  }
  if (latestBySession.size === 0) return snapshots;

  return snapshots.filter((snap) => {
    if (snap.phase !== "batch_request_submitted_to_staff") return true;
    if (!snap.batchQuoteSessionId) return true;
    return latestBySession.get(snap.batchQuoteSessionId)?.id === snap.id;
  });
}

/** Snapshots eligible for the customer product track record log. */
export function filterSnapshotsForProductTracking(
  snapshots: ItemRequestLineSnapshot[],
  options?: {
    hidePreEstimateEditEvents?: boolean;
    isBatchedProduct?: boolean;
  },
): ItemRequestLineSnapshot[] {
  let filtered = snapshots.filter((snap) => {
    if (options?.hidePreEstimateEditEvents && snap.phase === "pre_admin_estimate_edit") {
      return false;
    }
    if (shouldHideSnapshotFromProductTracking(snap.phase)) {
      return false;
    }
    if (options?.isBatchedProduct && snap.phase === "customer_line_edit") {
      return false;
    }
    return true;
  });

  if (options?.isBatchedProduct) {
    filtered = dedupeLatestBatchSubmissionSnapshots(filtered);
  }

  return filterDuplicateFrozenCopySnapshots(filtered, snapshots);
}

/** Drops snapshot rows whose line fields match the chronologically prior row. */
export function filterDuplicateFrozenCopySnapshots(
  snapshots: ItemRequestLineSnapshot[],
  fullHistory: ItemRequestLineSnapshot[] = snapshots,
): ItemRequestLineSnapshot[] {
  return snapshots.filter((snap) => {
    const prev = chronologicalPreviousSnapshot(snap, fullHistory);
    if (!prev) return true;
    return !isDuplicateFrozenCopySnapshotSummary(
      auditSnapshotChangeSummary(snap, prev),
    );
  });
}

export function snapshotPhaseDisplayLabel(
  phase: ItemRequestLineSnapshot["phase"],
  options?: { isBatchedProduct?: boolean },
): string {
  if (phase === "checkout_paid_pending_delivery") {
    return options?.isBatchedProduct ?
        "Batch checkout: paid"
      : "Single checkout product: paid";
  }
  return itemRequestLineSnapshotPhaseLabel(phase);
}

/** Phases where a batched line shows its slice of the saved batch estimate. */
export function shouldShowBatchEstimateShareForSnapshotPhase(
  phase: ItemRequestLineSnapshot["phase"],
): boolean {
  switch (phase) {
    case "batch_estimate_admin_copy":
    case "checkout_paid_pending_delivery":
    case "company_purchase_pending_delivery":
    case "warehouse_delivery_received":
    case "warehouse_delivery_received_prior":
    case "product_return_requested":
    case "product_return_tracking_saved":
    case "customer_refund_request_submitted":
      return true;
    default:
      return false;
  }
}

/** Snapshot phases where staff estimate total/note must not appear (customer-only baseline). */
export function shouldShowStaffEstimatePreviewForSnapshotPhase(
  phase: ItemRequestLineSnapshot["phase"],
): boolean {
  switch (phase) {
    case "customer_submission":
    case "customer_line_edit":
      return false;
    default:
      return true;
  }
}

/** Phases that show the saved single-product quote breakdown (not batch share). */
export function shouldShowSingleQuoteBreakdownForSnapshotPhase(
  phase: ItemRequestLineSnapshot["phase"],
): boolean {
  return (
    phase === "post_admin_estimate_edit" ||
    phase === "batch_request_submitted_to_staff" ||
    phase === "checkout_paid_pending_delivery" ||
    phase === "company_purchase_pending_delivery"
  );
}

/** Latest quote row saved on or before this snapshot was recorded. */
export function quoteAtOrBeforeSnapshot(
  row: ItemRequestLineSnapshot,
  quotes: ItemQuote[],
): ItemQuote | null {
  const snapshotMs = new Date(row.createdAt).getTime();
  const eligible = quotes.filter(
    (q) => new Date(q.createdAt).getTime() <= snapshotMs,
  );
  if (eligible.length === 0) return null;
  return (
    [...eligible].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null
  );
}

/**
 * Quote to show in a snapshot preview. Batch submission rows omit itemQuoteId,
 * so fall back to the staff estimate that existed when the snapshot was taken.
 */
export function quoteForSnapshotPreview(
  row: ItemRequestLineSnapshot,
  quotes: ItemQuote[],
  estimateQuote: ItemQuote | null = null,
): ItemQuote | null {
  if (!shouldShowStaffEstimatePreviewForSnapshotPhase(row.phase)) {
    return null;
  }
  if (row.itemQuoteId) {
    const linked = quotes.find((q) => q.id === row.itemQuoteId);
    if (linked) return linked;
  }
  if (shouldShowSingleQuoteBreakdownForSnapshotPhase(row.phase)) {
    return quoteAtOrBeforeSnapshot(row, quotes) ?? estimateQuote;
  }
  return quoteAtOrBeforeSnapshot(row, quotes) ?? estimateQuote;
}
