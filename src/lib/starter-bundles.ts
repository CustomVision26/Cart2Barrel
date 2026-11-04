export const STARTER_BUNDLE_SITE_NAME = "Starter Bundle" as const;
export const STARTER_BUNDLE_SOURCE_KIND = "starter_bundle" as const;
export const SHOPPING_LIST_PHOTO_SOURCE_KIND = "photo" as const;

export const STARTER_BUNDLE_STATUSES = ["draft", "published", "archived"] as const;
export type StarterBundleStatus = (typeof STARTER_BUNDLE_STATUSES)[number];

export const STARTER_BUNDLE_MAX_ITEMS = 40;

export const STARTER_BUNDLES_ROUTES = {
  listing: "/starter-bundles",
  detail: (bundleId: string) => `/starter-bundles/${bundleId}`,
  adminTab: "/admin/overview?tab=starter-bundles",
} as const;

export function isStarterBundleStatus(
  value: string | null | undefined,
): value is StarterBundleStatus {
  return (
    value === "draft" || value === "published" || value === "archived"
  );
}

export function isStarterBundleSourceKind(
  value: string | null | undefined,
): boolean {
  return value === STARTER_BUNDLE_SOURCE_KIND;
}

export function starterBundleItemProductUrl(
  listId: string,
  lineId: string,
): string {
  return `https://amanicart2-barrel.app/starter-bundle/${listId}/line/${lineId}`;
}

export type StarterBundleSnapshotItem = {
  sortIndex: number;
  productName: string;
  quantity: number;
  estimatedUnitPriceCents: number;
  productSize: string | null;
  productColor: string | null;
  retailerUrl: string | null;
  lineTotalCents: number;
};

export type StarterBundleSnapshot = {
  bundleId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  barrelSize: string | null;
  barrelFillLevel: string | null;
  updatedAt: string;
  merchandiseSubtotalCents: number;
  items: StarterBundleSnapshotItem[];
};

export function starterBundleLineTotalCents(
  quantity: number,
  estimatedUnitPriceCents: number,
): number {
  return quantity * estimatedUnitPriceCents;
}

export function starterBundleMerchandiseSubtotalCents(
  items: { quantity: number; estimatedUnitPriceCents: number }[],
): number {
  return items.reduce(
    (sum, item) =>
      sum + starterBundleLineTotalCents(item.quantity, item.estimatedUnitPriceCents),
    0,
  );
}

export const STARTER_BUNDLE_FEE_DISCLAIMER =
  "Estimated merchandise subtotal is the sum of quantity × estimated unit price for each product. Applicable service, freight, and broker fees will be shown separately in the quote. Destination pickup charges are separate.";
