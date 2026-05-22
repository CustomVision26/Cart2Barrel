export function buildVariantLabel(parts: {
  size?: string | null;
  color?: string | null;
  packLabel?: string | null;
  extra?: string | null;
}): string {
  const segments = [
    parts.color?.trim(),
    parts.size?.trim(),
    parts.packLabel?.trim(),
    parts.extra?.trim(),
  ].filter(Boolean) as string[];
  return segments.length > 0 ? segments.join(" · ") : "Default";
}

export function parseVariantKeys(
  variantKeys: string[] | undefined,
): { color: string | null; size: string | null; packLabel: string | null } {
  let color: string | null = null;
  let size: string | null = null;
  let packLabel: string | null = null;

  for (const key of variantKeys ?? []) {
    const lower = key.toLowerCase();
    if (lower.startsWith("actual_color-") || lower.startsWith("color-")) {
      color = key.split("-").slice(1).join(" ").replace(/_/g, " ");
    } else if (
      lower.startsWith("clothing_size-") ||
      lower.startsWith("size-") ||
      lower.includes("_size-")
    ) {
      size = key.split("-").slice(1).join(" ").replace(/_/g, " ").toUpperCase();
    } else if (lower.includes("pack") || lower.includes("count")) {
      packLabel = key.split("-").slice(1).join(" ");
    }
  }

  return { color, size, packLabel };
}

export function priceUsdToCents(usd: number | null | undefined): number | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return Math.round(usd * 100);
}
