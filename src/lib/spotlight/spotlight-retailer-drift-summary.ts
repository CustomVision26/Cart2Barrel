export const SPOTLIGHT_RETAILER_DRIFT_FIELDS = [
  "price",
  "url",
  "name",
  "image",
  "unavailable",
] as const;

export type SpotlightRetailerDriftField =
  (typeof SPOTLIGHT_RETAILER_DRIFT_FIELDS)[number];

export function spotlightRetailerDriftSummary(
  fields: readonly string[] | null | undefined,
): string | null {
  if (!fields || fields.length === 0) return null;
  const labels = fields.map((field) => {
    switch (field) {
      case "price":
        return "price";
      case "url":
        return "product URL";
      case "name":
        return "name";
      case "image":
        return "image";
      case "unavailable":
        return "listing availability";
      default:
        return field;
    }
  });
  if (labels.length === 1) {
    return `Retailer ${labels[0]} changed — check this product with the retailer.`;
  }
  const last = labels[labels.length - 1];
  return `Retailer ${labels.slice(0, -1).join(", ")} and ${last} changed — check this product with the retailer.`;
}
