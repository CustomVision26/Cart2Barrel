import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { spotlightCategoryProducts } from "@/db/schema";
import {
  getActiveSpotlightVariantForPrefill,
  listActiveVariantsByParentIds,
  listAdminVariantsByParentIds,
  type AdminSpotlightVariantRow,
  type PublicSpotlightVariant,
} from "@/data/spotlight-product-variants";
import type { SpotlightCategorySlug } from "@/lib/spotlight-categories";
import { sanitizeSpotlightUuidQueryParam } from "@/lib/spotlight-request-prefill";

export type { PublicSpotlightVariant } from "@/data/spotlight-product-variants";

export type PublicSpotlightProduct = {
  id: string;
  categorySlug: SpotlightCategorySlug;
  productUrl: string;
  imageUrl: string | null;
  priceUsdCents: number | null;
  productSize: string | null;
  productColor: string | null;
  label: string | null;
  variants: PublicSpotlightVariant[];
};

export type AdminSpotlightProductRow = Omit<
  PublicSpotlightProduct,
  "variants"
> & {
  variants: AdminSpotlightVariantRow[];
  sortIndex: number;
  isActive: boolean;
  createdAt: string;
};

function mapPublicRow(
  row: typeof spotlightCategoryProducts.$inferSelect,
  variants: PublicSpotlightVariant[] = [],
): PublicSpotlightProduct {
  return {
    id: row.id,
    categorySlug: row.categorySlug as SpotlightCategorySlug,
    productUrl: row.productUrl,
    imageUrl: row.imageUrl,
    priceUsdCents: row.priceUsdCents,
    productSize: row.productSize,
    productColor: row.productColor,
    label: row.label,
    variants,
  };
}

/** Active products for the home carousel and category dialog (public read). */
export async function listActiveSpotlightProductsByCategory(): Promise<
  Record<SpotlightCategorySlug, PublicSpotlightProduct[]>
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(spotlightCategoryProducts)
    .where(eq(spotlightCategoryProducts.isActive, true))
    .orderBy(
      asc(spotlightCategoryProducts.categorySlug),
      asc(spotlightCategoryProducts.sortIndex),
      desc(spotlightCategoryProducts.createdAt),
    );

  const parentUrlById = new Map(rows.map((r) => [r.id, r.productUrl]));
  const variantMap = await listActiveVariantsByParentIds(
    rows.map((r) => r.id),
    parentUrlById,
  );

  const grouped = {} as Record<SpotlightCategorySlug, PublicSpotlightProduct[]>;
  for (const row of rows) {
    const slug = row.categorySlug as SpotlightCategorySlug;
    if (!grouped[slug]) grouped[slug] = [];
    grouped[slug].push(
      mapPublicRow(row, variantMap.get(row.id) ?? []),
    );
  }
  return grouped;
}

/** All rows for admin management (including inactive). */
export async function listAdminSpotlightProducts(): Promise<AdminSpotlightProductRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(spotlightCategoryProducts)
    .orderBy(
      asc(spotlightCategoryProducts.categorySlug),
      asc(spotlightCategoryProducts.sortIndex),
      desc(spotlightCategoryProducts.createdAt),
    );

  const parentUrlById = new Map(rows.map((r) => [r.id, r.productUrl]));
  const variantMap = await listAdminVariantsByParentIds(
    rows.map((r) => r.id),
    parentUrlById,
  );

  return rows.map((row) => {
    const publicRow = mapPublicRow(row, variantMap.get(row.id) ?? []);
    const adminVariants = variantMap.get(row.id) ?? [];
    return {
      ...publicRow,
      variants: adminVariants,
      sortIndex: row.sortIndex,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  });
}

export async function getSpotlightProductById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(spotlightCategoryProducts)
    .where(eq(spotlightCategoryProducts.id, id))
    .limit(1);
  return row ?? null;
}

/** Active spotlight row for deep-link prefill (parent id, variant id, or URL). */
export async function getActiveSpotlightProductForPrefill(opts: {
  id?: string;
  variantId?: string;
  productUrl?: string;
}): Promise<PublicSpotlightProduct | null> {
  const variantId = sanitizeSpotlightUuidQueryParam(opts.variantId);
  if (variantId) {
    const hit = await getActiveSpotlightVariantForPrefill(variantId);
    if (!hit) return null;
    const parentUrlById = new Map([[hit.parent.id, hit.parent.productUrl]]);
    const variantMap = await listActiveVariantsByParentIds(
      [hit.parent.id],
      parentUrlById,
    );
    const parent = mapPublicRow(
      hit.parent,
      variantMap.get(hit.parent.id) ?? [],
    );
    return spotlightProductFromVariant(parent, hit.variant);
  }

  const db = getDb();
  const parentId = sanitizeSpotlightUuidQueryParam(opts.id);
  if (parentId) {
    const [row] = await db
      .select()
      .from(spotlightCategoryProducts)
      .where(
        and(
          eq(spotlightCategoryProducts.id, parentId),
          eq(spotlightCategoryProducts.isActive, true),
        ),
      )
      .limit(1);
    if (!row) return null;
    const parentUrlById = new Map([[row.id, row.productUrl]]);
    const variantMap = await listActiveVariantsByParentIds(
      [row.id],
      parentUrlById,
    );
    return mapPublicRow(row, variantMap.get(row.id) ?? []);
  }
  const url = opts.productUrl?.trim();
  if (!url) return null;
  const [row] = await db
    .select()
    .from(spotlightCategoryProducts)
    .where(
      and(
        eq(spotlightCategoryProducts.productUrl, url),
        eq(spotlightCategoryProducts.isActive, true),
      ),
    )
    .limit(1);
  if (!row) return null;
  const parentUrlById = new Map([[row.id, row.productUrl]]);
  const variantMap = await listActiveVariantsByParentIds(
    [row.id],
    parentUrlById,
  );
  return mapPublicRow(row, variantMap.get(row.id) ?? []);
}

/** Prefill shaped from a specific active variant (overrides parent price/size/color/url). */
export function spotlightProductFromVariant(
  parent: PublicSpotlightProduct,
  variant: PublicSpotlightVariant,
): PublicSpotlightProduct {
  return {
    ...parent,
    productUrl: variant.productUrl,
    imageUrl: variant.imageUrl ?? parent.imageUrl,
    priceUsdCents: variant.priceUsdCents ?? parent.priceUsdCents,
    productSize: variant.productSize ?? parent.productSize,
    productColor: variant.productColor ?? parent.productColor,
    label: variant.label?.trim() || parent.label,
    variants: parent.variants,
  };
}

export async function nextSpotlightSortIndex(categorySlug: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ sortIndex: spotlightCategoryProducts.sortIndex })
    .from(spotlightCategoryProducts)
    .where(eq(spotlightCategoryProducts.categorySlug, categorySlug))
    .orderBy(desc(spotlightCategoryProducts.sortIndex))
    .limit(1);
  return (row?.sortIndex ?? -1) + 1;
}

export async function updateSpotlightProductImage(
  id: string,
  imageUrl: string | null,
): Promise<void> {
  const db = getDb();
  await db
    .update(spotlightCategoryProducts)
    .set({ imageUrl })
    .where(eq(spotlightCategoryProducts.id, id));
}

export async function updateSpotlightProductDetails(
  id: string,
  patch: {
    priceUsdCents?: number | null;
    productSize?: string | null;
    productColor?: string | null;
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(spotlightCategoryProducts)
    .set(patch)
    .where(eq(spotlightCategoryProducts.id, id));
}
