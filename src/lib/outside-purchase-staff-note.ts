/** Prepended to outside-purchase intake staff notes (customer must pay before barrel). */
export const OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX =
  "Please note that the outside purchase service and handling fee must be paid before the product can be added to your barrel. Outside-purchase fee tiers apply; in-app service and handling fees do not.";

export function withOutsidePurchaseStaffNotePrefix(note: string | undefined): string {
  const trimmed = note?.trim() ?? "";
  if (trimmed.startsWith(OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX)) {
    return trimmed;
  }
  if (trimmed === "") {
    return OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX;
  }
  return `${OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX}\n\n${trimmed}`;
}
