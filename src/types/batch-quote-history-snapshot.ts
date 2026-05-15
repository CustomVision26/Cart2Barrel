/** Frozen customer-visible batch bundle state persisted on each status event (`detail.snapshot`). */

export const BATCH_QUOTE_HISTORY_SNAPSHOT_V = 1 as const;

export type BatchQuoteHistorySnapshotLine = {
  productName: string | null;
  productUrl: string;
  siteName: string | null;
  productImageUrl: string | null;
};

export type BatchQuoteHistorySnapshotEstimate = {
  id: string;
  subtotalCents: number;
  savedAt: string;
};

export type BatchQuoteHistorySnapshot = {
  v: typeof BATCH_QUOTE_HISTORY_SNAPSHOT_V;
  /** Same values as `batch_quote_session_status_events.kind`. */
  kind: string;
  /** Customer-facing label for this stage (matches event kind labels). */
  stageLabel: string;
  batchNumber: string;
  siteKey: string;
  /** `batch_quote_sessions.status` after this transition. */
  sessionStatus: string;
  submittedAt: string | null;
  cartAcceptanceAcceptedAt: string | null;
  estimate: BatchQuoteHistorySnapshotEstimate | null;
  lines: BatchQuoteHistorySnapshotLine[];
  orderId?: string;
};

export type BatchQuoteSessionStatusEventDetail = {
  orderId?: string;
  snapshot?: BatchQuoteHistorySnapshot;
};
