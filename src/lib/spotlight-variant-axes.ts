export type SpotlightVariantSku = {
  id: string;
  color: string | null;
  size: string | null;
  packLabel: string | null;
  imageUrl: string | null;
  priceUsdCents: number | null;
  storeUrl: string;
  addHref: string;
};

export type SpotlightVariantAxisValue = {
  key: string;
  label: string;
  imageUrl: string | null;
  priceUsdCents: number | null;
};

function norm(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function variantAxisKey(value: string | null | undefined): string {
  return (norm(value) ?? "").toLowerCase();
}

function uniqueAxis(
  skus: SpotlightVariantSku[],
  pick: (sku: SpotlightVariantSku) => string | null,
): SpotlightVariantAxisValue[] {
  const seen = new Map<string, SpotlightVariantAxisValue>();
  for (const sku of skus) {
    const label = pick(sku);
    if (!label) continue;
    const key = variantAxisKey(label);
    const existing = seen.get(key);
    if (existing) {
      if (!existing.imageUrl && sku.imageUrl) existing.imageUrl = sku.imageUrl;
      if (
        sku.priceUsdCents != null &&
        sku.priceUsdCents > 0 &&
        (existing.priceUsdCents == null ||
          sku.priceUsdCents < existing.priceUsdCents)
      ) {
        existing.priceUsdCents = sku.priceUsdCents;
      }
      continue;
    }
    seen.set(key, {
      key,
      label,
      imageUrl: sku.imageUrl,
      priceUsdCents: sku.priceUsdCents,
    });
  }
  return [...seen.values()];
}

export function buildSpotlightVariantAxes(skus: SpotlightVariantSku[]) {
  const colors = uniqueAxis(skus, (sku) => sku.color);
  const sizes = uniqueAxis(skus, (sku) => sku.size);
  const packs = uniqueAxis(skus, (sku) => sku.packLabel);
  return {
    colors,
    sizes,
    packs: sizes.length > 0 ? [] : packs,
  };
}

export function hasSpotlightVariantPicker(skus: SpotlightVariantSku[]): boolean {
  const axes = buildSpotlightVariantAxes(skus);
  return (
    axes.colors.length > 0 || axes.sizes.length > 0 || axes.packs.length > 0
  );
}

export function findSpotlightVariantSku(
  skus: SpotlightVariantSku[],
  colorKey: string | null,
  sizeKey: string | null,
  packKey: string | null,
): SpotlightVariantSku | null {
  const matches = skus.filter((sku) => {
    if (colorKey != null && variantAxisKey(sku.color) !== colorKey) return false;
    if (sizeKey != null && variantAxisKey(sku.size) !== sizeKey) return false;
    if (packKey != null && variantAxisKey(sku.packLabel) !== packKey) return false;
    return true;
  });
  return matches[0] ?? null;
}

export function firstAvailableSizeKey(
  skus: SpotlightVariantSku[],
  colorKey: string | null,
  sizeKeys: string[],
): string | null {
  for (const sizeKey of sizeKeys) {
    if (findSpotlightVariantSku(skus, colorKey, sizeKey, null)) return sizeKey;
  }
  return sizeKeys[0] ?? null;
}

export function firstAvailablePackKey(
  skus: SpotlightVariantSku[],
  colorKey: string | null,
  packKeys: string[],
): string | null {
  for (const packKey of packKeys) {
    if (findSpotlightVariantSku(skus, colorKey, null, packKey)) return packKey;
  }
  return packKeys[0] ?? null;
}

export function colorSwatchPrice(
  skus: SpotlightVariantSku[],
  colorKey: string,
  sizeKey: string | null,
  packKey: string | null,
): number | null {
  const exact = findSpotlightVariantSku(skus, colorKey, sizeKey, packKey);
  if (exact?.priceUsdCents != null && exact.priceUsdCents > 0) {
    return exact.priceUsdCents;
  }
  const forColor = skus.filter((sku) => variantAxisKey(sku.color) === colorKey);
  let min: number | null = null;
  for (const sku of forColor) {
    if (sku.priceUsdCents == null || sku.priceUsdCents <= 0) continue;
    if (min == null || sku.priceUsdCents < min) min = sku.priceUsdCents;
  }
  return min;
}
