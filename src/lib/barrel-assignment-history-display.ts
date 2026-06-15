import type { AssignmentHistoryRow } from "@/data/barrel-package-assignment";

export type ProductAssignmentTrack = {
  packageId: string;
  events: AssignmentHistoryRow[];
  latest: AssignmentHistoryRow;
};

export function assignmentHistoryEventMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function formatAssignmentHistoryWhen(
  iso: string,
  compact = false,
): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: compact ? "short" : "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function assignmentHistoryActionLabel(
  action: AssignmentHistoryRow["action"],
): string {
  switch (action) {
    case "assigned":
      return "Assigned";
    case "reassigned":
      return "Reassigned";
    case "removed":
      return "Removed";
  }
}

export function assignmentHistoryActionBadgeClass(
  action: AssignmentHistoryRow["action"],
): string {
  switch (action) {
    case "assigned":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "reassigned":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "removed":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
}

export function groupAssignmentHistoryIntoProductTracks(
  events: AssignmentHistoryRow[],
): ProductAssignmentTrack[] {
  const map = new Map<string, AssignmentHistoryRow[]>();
  for (const event of events) {
    const list = map.get(event.packageId) ?? [];
    list.push(event);
    map.set(event.packageId, list);
  }

  return [...map.entries()]
    .map(([packageId, trackEvents]) => {
      const sorted = [...trackEvents].sort(
        (a, b) =>
          assignmentHistoryEventMs(b.createdAt) - assignmentHistoryEventMs(a.createdAt),
      );
      return {
        packageId,
        events: sorted,
        latest: sorted[0]!,
      };
    })
    .sort(
      (a, b) =>
        assignmentHistoryEventMs(b.latest.createdAt) -
        assignmentHistoryEventMs(a.latest.createdAt),
    );
}

export function assignmentHistoryRowMatchesQuery(
  row: AssignmentHistoryRow,
  q: string,
): boolean {
  if (!q) return true;
  const chunks = [
    row.productNameSnapshot,
    row.barrelLabelSnapshot,
    row.adminNote,
    assignmentHistoryActionLabel(row.action),
  ];
  return chunks.some(
    (chunk) => chunk != null && String(chunk).toLowerCase().includes(q),
  );
}

export function assignmentHistoryTrackMatchesQuery(
  track: ProductAssignmentTrack,
  q: string,
): boolean {
  return track.events.some((event) => assignmentHistoryRowMatchesQuery(event, q));
}
