import { noteWithLatestReturnEstimateOnly } from "@/lib/outside-purchase-staff-note-display";

/** Machine-readable pack metadata appended to outside-purchase staff notes. */
const OP_PACK_META_LINE_RE = /^\s*\[op-pack\]\s*unitsPerPack=\d+\s*$/i;

export type StaffNoteDisplayItem =
  | { kind: "message"; text: string }
  | { kind: "detail"; label: string; value: string };

/** Paragraphs for customer UI; strips pack metadata lines only. */
export function formatStaffNoteParagraphsForDisplay(
  staffNote: string | null | undefined,
): string[] {
  if (!staffNote?.trim()) return [];

  const normalized = noteWithLatestReturnEstimateOnly(staffNote.trim());

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !OP_PACK_META_LINE_RE.test(line))
        .join("\n")
        .trim(),
    )
    .filter((p) => p.length > 0);

  return paragraphs;
}

function tryParseDetailLine(line: string): StaffNoteDisplayItem | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) return null;

  const label = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1).trim();
  if (!label || !value) return null;

  return { kind: "detail", label, value };
}

/** Structured rows for uniform customer/admin note UI. */
export function formatStaffNoteItemsForDisplay(
  staffNote: string | null | undefined,
): StaffNoteDisplayItem[] {
  const items: StaffNoteDisplayItem[] = [];

  for (const paragraph of formatStaffNoteParagraphsForDisplay(staffNote)) {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    if (lines.length === 1) {
      const detail = tryParseDetailLine(lines[0]!);
      items.push(detail ?? { kind: "message", text: lines[0]! });
      continue;
    }

    const parsedLines = lines.map((line) => tryParseDetailLine(line));
    if (parsedLines.every((item) => item != null)) {
      items.push(...(parsedLines as StaffNoteDisplayItem[]));
      continue;
    }

    items.push({ kind: "message", text: paragraph });
  }

  return items;
}

export function hasDisplayableStaffNote(
  staffNote: string | null | undefined,
): boolean {
  return formatStaffNoteItemsForDisplay(staffNote).length > 0;
}
