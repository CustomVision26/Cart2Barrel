/** Shown when a snapshot row repeats the same frozen line copy as the prior row. */
export const AUDIT_NO_LINE_FIELD_DIFF_SUMMARY =
  "No differences in captured line fields vs prior row (same frozen copy).";

/** Shown on the first snapshot row when there is no prior row to compare. */
export const AUDIT_BASELINE_SNAPSHOT_SUMMARY =
  "First event on this timeline — baseline snapshot.";

export function isDuplicateFrozenCopySnapshotSummary(summary: string): boolean {
  return summary.startsWith(AUDIT_NO_LINE_FIELD_DIFF_SUMMARY);
}

export function isBaselineSnapshotSummary(summary: string): boolean {
  return summary.startsWith(AUDIT_BASELINE_SNAPSHOT_SUMMARY);
}

/** Change summaries omitted from post-checkout order history timelines. */
export function isHiddenTimelineSnapshotSummary(summary: string): boolean {
  return (
    isDuplicateFrozenCopySnapshotSummary(summary) ||
    isBaselineSnapshotSummary(summary)
  );
}
