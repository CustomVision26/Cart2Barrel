/** Machine-readable pack metadata appended to outside-purchase staff notes. */
const OP_PACK_META_LINE_RE = /^\s*\[op-pack\]\s*unitsPerPack=\d+\s*$/i;

/** Paragraphs for customer UI; strips pack metadata lines only. */
export function formatStaffNoteParagraphsForDisplay(
  staffNote: string | null | undefined,
): string[] {
  if (!staffNote?.trim()) return [];

  const paragraphs = staffNote
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

export function hasDisplayableStaffNote(
  staffNote: string | null | undefined,
): boolean {
  return formatStaffNoteParagraphsForDisplay(staffNote).length > 0;
}
