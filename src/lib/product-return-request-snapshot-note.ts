import type { ItemRequestLineSnapshot } from "@/db/schema";

export function productReturnRequestNoteFromSnapshot(
  row: Pick<ItemRequestLineSnapshot, "phase" | "note">,
): string | null {
  if (row.phase !== "product_return_requested") return null;
  const trimmed = row.note?.trim();
  return trimmed || null;
}

/** Customer return-request note linked to a tracking-saved (or requested) snapshot row. */
export function productReturnRequestNoteForSnapshot(
  row: ItemRequestLineSnapshot,
  snapshots?: readonly ItemRequestLineSnapshot[] | null,
): string | null {
  if (row.phase === "product_return_requested") {
    return productReturnRequestNoteFromSnapshot(row);
  }
  if (row.phase !== "product_return_tracking_saved") return null;

  if (!snapshots?.length) return null;
  const atMs = new Date(row.createdAt).getTime();
  const candidates = snapshots.filter(
    (snap) =>
      snap.phase === "product_return_requested" &&
      new Date(snap.createdAt).getTime() <= atMs,
  );
  if (candidates.length === 0) return null;

  const latest = [...candidates].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  return latest ? productReturnRequestNoteFromSnapshot(latest) : null;
}
