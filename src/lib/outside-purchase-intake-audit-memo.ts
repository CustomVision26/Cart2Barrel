import type { ItemRequestLineSnapshot } from "@/db/schema";
import { parseOutsidePurchaseReceivedCondition } from "@/lib/outside-purchase-display";
import { parseOutsidePurchaseStaffNoteDisplay } from "@/lib/outside-purchase-staff-note-display";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

/** Condition segment from staff intake/update audit memos. */
export function parseOutsidePurchaseIntakeAuditMemoCondition(
  auditMemo: string | null | undefined,
): string | null {
  const trimmed = auditMemo?.trim();
  if (!trimmed) return null;
  if (
    !trimmed.startsWith("Outside purchase intake") &&
    !trimmed.startsWith("Outside purchase updated")
  ) {
    return null;
  }
  const parts = trimmed.split("·").map((part) => part.trim());
  if (parts.length < 3) return null;
  return parts[2] || null;
}

/** Audit table / preview headline for outside-purchase intake snapshots. */
export function outsidePurchaseIntakeDraftStatusLabel(
  auditMemo: string | null | undefined,
): string {
  const condition = parseOutsidePurchaseIntakeAuditMemoCondition(auditMemo);
  return condition ? `Intake Draft · ${condition}` : "Intake Draft";
}

export function parseOutsidePurchaseConditionFromStaffNote(
  staffNote: string | null | undefined,
): string | null {
  if (!staffNote?.trim()) return null;
  const parsed = parseOutsidePurchaseStaffNoteDisplay(staffNote.trim());
  const field = parsed.fields.find((field) => field.label === "Received condition");
  return field?.value?.trim() || null;
}

export type OutsidePurchaseAuditTreeRole = "intake-parent" | "published-child";

export type OutsidePurchaseAuditTreeLink = {
  role: OutsidePurchaseAuditTreeRole;
  /** Paired intake or publish snapshot id, when linked. */
  partnerId: string | null;
};

function snapshotsChronological(
  snapshots: readonly ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot[] {
  return [...snapshots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Maps intake ↔ publish snapshot ids for parent/child audit UI. */
export function linkOutsidePurchaseIntakePublishSnapshots(
  snapshots: readonly ItemRequestLineSnapshot[],
): Map<string, OutsidePurchaseAuditTreeLink> {
  const links = new Map<string, OutsidePurchaseAuditTreeLink>();
  let pendingIntake: ItemRequestLineSnapshot | null = null;

  for (const snap of snapshotsChronological(snapshots)) {
    if (snap.phase === "outside_purchase_intake") {
      pendingIntake = snap;
      links.set(snap.id, { role: "intake-parent", partnerId: null });
      continue;
    }
    if (snap.phase === "outside_purchase_published" && pendingIntake) {
      links.set(snap.id, {
        role: "published-child",
        partnerId: pendingIntake.id,
      });
      const intakeLink = links.get(pendingIntake.id);
      if (intakeLink) {
        intakeLink.partnerId = snap.id;
      }
      pendingIntake = null;
    }
  }

  return links;
}

export function resolveOutsidePurchaseConditionForAudit(params: {
  row: ItemRequestLineSnapshot;
  snapshots: readonly ItemRequestLineSnapshot[];
  quoteStaffNote?: string | null;
  receivedConditionRaw?: string | null;
}): string | null {
  const fromStaffNote = parseOutsidePurchaseConditionFromStaffNote(
    params.quoteStaffNote,
  );
  if (fromStaffNote) return fromStaffNote;

  if (params.row.phase === "outside_purchase_intake") {
    return parseOutsidePurchaseIntakeAuditMemoCondition(params.row.auditMemo);
  }

  const rowTime = new Date(params.row.createdAt).getTime();
  let nearestIntake: ItemRequestLineSnapshot | null = null;

  for (const snap of snapshotsChronological(params.snapshots)) {
    if (snap.phase !== "outside_purchase_intake") continue;
    const snapTime = new Date(snap.createdAt).getTime();
    if (snapTime <= rowTime) {
      nearestIntake = snap;
    }
  }

  if (nearestIntake) {
    const fromIntake = parseOutsidePurchaseIntakeAuditMemoCondition(
      nearestIntake.auditMemo,
    );
    if (fromIntake) return fromIntake;
  }

  for (const snap of snapshotsChronological(params.snapshots)) {
    if (snap.phase === "outside_purchase_intake") {
      const fromIntake = parseOutsidePurchaseIntakeAuditMemoCondition(
        snap.auditMemo,
      );
      if (fromIntake) return fromIntake;
    }
  }

  const parsed = parseOutsidePurchaseReceivedCondition(
    params.receivedConditionRaw,
  );
  if (parsed) return warehouseReceiveConditionLabel(parsed);

  return null;
}

/** Audit headline when staff published an outside purchase to the customer. */
export function outsidePurchasePublishedStatusLabel(params: {
  row: ItemRequestLineSnapshot;
  snapshots?: readonly ItemRequestLineSnapshot[];
  quoteStaffNote?: string | null;
  receivedConditionRaw?: string | null;
}): string {
  const condition =
    params.snapshots ?
      resolveOutsidePurchaseConditionForAudit({
        row: params.row,
        snapshots: params.snapshots,
        quoteStaffNote: params.quoteStaffNote,
        receivedConditionRaw: params.receivedConditionRaw,
      })
    : parseOutsidePurchaseConditionFromStaffNote(params.quoteStaffNote) ??
      (() => {
        const parsed = parseOutsidePurchaseReceivedCondition(
          params.receivedConditionRaw,
        );
        return parsed ? warehouseReceiveConditionLabel(parsed) : null;
      })();
  return condition ? `Received: ${condition}` : "Received";
}

export function findOutsidePurchaseAuditPartner(
  row: ItemRequestLineSnapshot,
  snapshots: readonly ItemRequestLineSnapshot[],
): ItemRequestLineSnapshot | null {
  const links = linkOutsidePurchaseIntakePublishSnapshots(snapshots);
  const link = links.get(row.id);
  if (!link?.partnerId) return null;
  return snapshots.find((snap) => snap.id === link.partnerId) ?? null;
}

export type AuditSnapshotStatusContext = {
  snapshots?: readonly ItemRequestLineSnapshot[];
  quoteStaffNote?: string | null;
  /** Live request received condition when snapshot memos lack it. */
  receivedConditionRaw?: string | null;
};
