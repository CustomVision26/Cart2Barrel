export type BarrelContentItem = {
  packageId: string;
  productName: string;
  productImageUrl: string | null;
  productSize: string | null;
  productColor: string | null;
  quantity: number;
  /** Consumer units included in one pack (quote “Consumer units per pack”). */
  unitsPerPack: number;
  linePriceCents: number;
};

export type BarrelContentsRecord = {
  barrelId: string;
  containerName: string;
  containerAlias: string;
  slotLabel: string;
  items: BarrelContentItem[];
};

export function clampBarrelContentUnitsPerPack(value: number | null | undefined): number {
  const n = Math.floor(Number(value) || 0);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(9999, n);
}

export function barrelContentsTotalCents(items: BarrelContentItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.linePriceCents), 0);
}

export function barrelContentUnitPriceCents(item: BarrelContentItem): number | null {
  if (item.quantity <= 0) return null;
  return Math.round(item.linePriceCents / item.quantity);
}

export function barrelContentsDownloadFilename(containerLabel: string): string {
  const slug =
    containerLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "container";
  return `${slug}-contents.pdf`;
}
