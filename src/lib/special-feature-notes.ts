/**
 * Default shopper-facing note when admin leaves Notes blank (or equal to this).
 */
export const SPECIAL_FEATURE_AUTO_NOTES = [
  "This special offers express delivery through a company courier traveler departing for Jamaica during the offer period. The traveler has capacity to carry a second and third suitcase to the special destination. Customers who wish to participate can purchase a suitcase of their choice and pack its contents through AmaniCart2Barrel via in-app tools, or, if they prefer to pack their own suitcase, must do so before the special ends.",
  "",
  "In-app packaging charges:",
  "1. Suitcase purchase fee",
  "2. Product purchase fees for items packed in the suitcase, plus service and handling fees",
  "3. Packing fee",
  "4. Transportation to destination fee (courier fee)",
  "5. Airline bag fee (varies by airline)",
  "",
  "Outside packaging charges (customer packs their own suitcase):",
  "1. Service and handling fee for the suitcase and its contents",
  "2. Transportation to destination fee (courier fee)",
  "3. Airline bag fee (varies by airline)",
  "",
  "Customers who pack their own suitcase and send it to the hub will incur applicable service and handling charges for the suitcase and its contents. All suitcases are inspected for drugs and other illegal substances or items. Any suitcase found to contain such materials will be rejected, and the police will be contacted.",
].join("\n");

/** Older auto-note copies still treated as “not overwritten”. */
const SPECIAL_FEATURE_AUTO_NOTES_ALIASES = [
  SPECIAL_FEATURE_AUTO_NOTES,
  "This special offers express delivery through a company courier traveler departing for Jamaica during the offer period. The traveler has capacity to carry a second and third suitcase to the special destination. Customers who wish to participate can purchase a suitcase of their choice and pack its contents through AmaniCart2Barrel via in-app tools, or, if they prefer to pack their own suitcase, must do so before the special ends.\n\nCustomers who pack their own suitcase and send it to the hub will incur applicable service and handling charges for the suitcase and its contents. All suitcases are inspected for drugs and other illegal substances or items. Any suitcase found to contain such materials will be rejected, and the police will be contacted.",
  "This special offers express delivery through a company courier traveler departing for Jamaica during the offer period. The traveler has capacity to carry a second, third, and fourth suitcase to the special destination. Customers who wish to participate must send their suitcase before the special ends. Customers who pack their own suitcase and send it to the hub will incur applicable service and handling charges for the suitcase and its contents. All suitcases are inspected for drugs and other illegal substances or items. Any suitcase found to contain such materials will be rejected, and the police will be contacted.",
  "This special offers express delivery by a company courier traveler going to Jamaica during the offer period. They have space to carry a second, third, and fourth suitcase with them when they travel to the special destination. If you wish to take this special, you must send your suitcase before the special ends.",
  "This special offers express delivery by a company courier traveler going to Jamaica during the offer period. They have space to carry a second, third, and fourth suitcase with them when they travel to the special destination.",
] as const;

function isAutoNotes(trimmed: string): boolean {
  return (
    !trimmed ||
    (SPECIAL_FEATURE_AUTO_NOTES_ALIASES as readonly string[]).includes(trimmed)
  );
}

/** Resolve display notes: admin overwrite wins; otherwise the auto note. */
export function resolveSpecialFeatureNotes(notes: string | null | undefined): string {
  const trimmed = notes?.trim() ?? "";
  if (isAutoNotes(trimmed)) return SPECIAL_FEATURE_AUTO_NOTES;
  return trimmed;
}

/**
 * Persist empty when admin kept the auto note (or cleared the field),
 * so banners keep using the auto copy until they overwrite.
 */
export function persistSpecialFeatureNotes(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (isAutoNotes(trimmed)) return "";
  return trimmed;
}
