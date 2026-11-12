const SIZE_TABLE: { pattern: RegExp; canonical: string; label: string }[] = [
  { pattern: /\b(?:xxx-large|xxxl|3xl)\b/i, canonical: "xxxl", label: "XXXL" },
  { pattern: /\b(?:xx-large|xxl|2xl)\b/i, canonical: "xxl", label: "XXL" },
  { pattern: /\b(?:x-large|xlarge|xl)\b/i, canonical: "xl", label: "XL" },
  { pattern: /\b(?:x-small|xsmall|xs)\b/i, canonical: "xs", label: "XS" },
  { pattern: /\blarge\b/i, canonical: "l", label: "Large" },
  { pattern: /\bmedium\b/i, canonical: "m", label: "Medium" },
  { pattern: /\bsmall\b/i, canonical: "s", label: "Small" },
  { pattern: /\bsize[\s-]*l\b/i, canonical: "l", label: "Large" },
  { pattern: /\bsize[\s-]*m\b/i, canonical: "m", label: "Medium" },
  { pattern: /\bsize[\s-]*s\b/i, canonical: "s", label: "Small" },
];

const COLOR_WORDS = [
  "black",
  "white",
  "navy",
  "blue",
  "red",
  "green",
  "gray",
  "grey",
  "brown",
  "beige",
  "pink",
  "purple",
  "yellow",
  "orange",
  "khaki",
  "olive",
];

export type SizeJudgment = "match" | "conflict" | "unknown";

export function detectClothingSize(
  text: string | null | undefined,
): { canonical: string; label: string } | null {
  if (!text?.trim()) return null;
  for (const row of SIZE_TABLE) {
    if (row.pattern.test(text)) return { canonical: row.canonical, label: row.label };
  }
  return null;
}

export function clothingSizeFromInstructions(
  text: string | null | undefined,
): string | null {
  return detectClothingSize(text)?.label ?? null;
}

export function judgeClothingSize(
  haystack: string,
  requested: string | null | undefined,
): SizeJudgment {
  const wanted = detectClothingSize(requested);
  if (!wanted) return "unknown";
  const found = detectClothingSize(haystack);
  if (!found) return "unknown";
  return found.canonical === wanted.canonical ? "match" : "conflict";
}

export function detectPackCount(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const match = text.match(/(\d+)\s*[- ]?\s*(?:pack|pk|count|ct)\b/i);
  const bare = match ? null : text.trim().match(/^(\d+)$/);
  const digits = match?.[1] ?? bare?.[1];
  if (!digits) return null;
  const count = Number(digits);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function packLabelFromText(text: string | null | undefined): string | null {
  const count = detectPackCount(text);
  return count == null ? null : `${count} pack`;
}

export function judgePackSize(
  haystack: string,
  requested: string | null | undefined,
): SizeJudgment {
  const wanted = detectPackCount(requested);
  if (wanted == null) return "unknown";
  const found = detectPackCount(haystack);
  if (found == null) return "unknown";
  return found === wanted ? "match" : "conflict";
}

export function detectColor(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const lower = text.toLowerCase();
  const found = COLOR_WORDS.find((color) => new RegExp(`\\b${color}\\b`, "i").test(lower));
  return found ?? null;
}

export function judgeColor(
  haystack: string,
  requested: string | null | undefined,
): SizeJudgment {
  const wanted = detectColor(requested);
  if (!wanted) return "unknown";
  const found = detectColor(haystack);
  if (!found) return "unknown";
  const same =
    wanted === found ||
    (wanted === "gray" && found === "grey") ||
    (wanted === "grey" && found === "gray");
  return same ? "match" : "conflict";
}

export function marketplaceSellerName(
  seller: string | null | undefined,
  retailerLabel: string,
): string | null {
  const trimmed = seller?.trim() ?? "";
  if (!trimmed) return null;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sellerToken = normalize(trimmed);
  const retailerToken = normalize(retailerLabel);
  if (!sellerToken || !retailerToken) return null;
  if (
    sellerToken === retailerToken ||
    sellerToken.startsWith(retailerToken) ||
    retailerToken.startsWith(sellerToken)
  ) {
    return null;
  }
  return trimmed;
}
