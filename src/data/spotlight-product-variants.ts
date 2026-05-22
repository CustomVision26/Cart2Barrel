import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  spotlightCategoryProducts,
  spotlightProductVariants,
} from "@/db/schema";
import { isMissingSpotlightVariantsTableError } from "@/lib/spotlight-db-safe";

export type PublicSpotlightVariant = {
  id: string;
  parentProductId: string;
  productUrl: string;
  imageUrl: string | null;
  priceUsdCents: number | null;
  productSize: string | null;
  productColor: string | null;
  packLabel: string | null;
  label: string | null;
};

export type AdminSpotlightVariantRow = PublicSpotlightVariant & {
  sortIndex: number;
  isActive: boolean;
  createdAt: string;
};

function resolveVariantUrl(
  variantUrl: string | null,
  parentUrl: string,
): string {
  const v = variantUrl?.trim();
  if (v && /^https:\/\//i.test(v)) return v;
  return parentUrl;
}

function mapPublicVariant(
  row: typeof spotlightProductVariants.$inferSelect,
  parentUrl: string,
): PublicSpotlightVariant {
  return {
    id: row.id,
    parentProductId: row.parentProductId,
    productUrl: resolveVariantUrl(row.productUrl, parentUrl),
    imageUrl: row.imageUrl,
    priceUsdCents: row.priceUsdCents,
    productSize: row.productSize,
    productColor: row.productColor,
    packLabel: row.packLabel,
    label: row.label,
  };
}

export async function listActiveVariantsByParentIds(
  parentIds: string[],
  parentUrlById: Map<string, string>,
): Promise<Map<string, PublicSpotlightVariant[]>> {
  const out = new Map<string, PublicSpotlightVariant[]>();
  if (parentIds.length === 0) return out;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(spotlightProductVariants)
      .where(
        and(
          inArray(spotlightProductVariants.parentProductId, parentIds),
          eq(spotlightProductVariants.isActive, true),
        ),
      )
      .orderBy(
        asc(spotlightProductVariants.parentProductId),
        asc(spotlightProductVariants.sortIndex),
        desc(spotlightProductVariants.createdAt),
      );

    for (const row of rows) {
      const parentUrl = parentUrlById.get(row.parentProductId);
      if (!parentUrl) continue;
      const list = out.get(row.parentProductId) ?? [];
      list.push(mapPublicVariant(row, parentUrl));
      out.set(row.parentProductId, list);
    }
  } catch (err) {
    if (!isMissingSpotlightVariantsTableError(err)) throw err;
  }

  return out;
}

export async function listAdminVariantsByParentIds(
  parentIds: string[],
  parentUrlById: Map<string, string>,
): Promise<Map<string, AdminSpotlightVariantRow[]>> {
  const out = new Map<string, AdminSpotlightVariantRow[]>();
  if (parentIds.length === 0) return out;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(spotlightProductVariants)
      .where(inArray(spotlightProductVariants.parentProductId, parentIds))
      .orderBy(
        asc(spotlightProductVariants.parentProductId),
        asc(spotlightProductVariants.sortIndex),
        desc(spotlightProductVariants.createdAt),
      );

    for (const row of rows) {
      const parentUrl = parentUrlById.get(row.parentProductId);
      if (!parentUrl) continue;
      const list = out.get(row.parentProductId) ?? [];
      list.push({
        ...mapPublicVariant(row, parentUrl),
        sortIndex: row.sortIndex,
        isActive: row.isActive,
        createdAt: row.createdAt,
      });
      out.set(row.parentProductId, list);
    }
  } catch (err) {
    if (!isMissingSpotlightVariantsTableError(err)) throw err;
  }

  return out;
}

export async function getSpotlightVariantById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(spotlightProductVariants)
    .where(eq(spotlightProductVariants.id, id))
    .limit(1);
  return row ?? null;
}

/** Active variant with parent row for storefront prefill. */
export async function getActiveSpotlightVariantForPrefill(
  variantId: string,
): Promise<{
  variant: PublicSpotlightVariant;
  parent: typeof spotlightCategoryProducts.$inferSelect;
} | null> {
  try {
    const db = getDb();
    const [joined] = await db
      .select({
        variant: spotlightProductVariants,
        parent: spotlightCategoryProducts,
      })
      .from(spotlightProductVariants)
      .innerJoin(
        spotlightCategoryProducts,
        eq(
          spotlightProductVariants.parentProductId,
          spotlightCategoryProducts.id,
        ),
      )
      .where(
        and(
          eq(spotlightProductVariants.id, variantId.trim()),
          eq(spotlightProductVariants.isActive, true),
          eq(spotlightCategoryProducts.isActive, true),
        ),
      )
      .limit(1);

    if (!joined) return null;

    return {
      parent: joined.parent,
      variant: mapPublicVariant(joined.variant, joined.parent.productUrl),
    };
  } catch (err) {
    if (isMissingSpotlightVariantsTableError(err)) return null;
    throw err;
  }
}

export async function nextSpotlightVariantSortIndex(
  parentProductId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ sortIndex: spotlightProductVariants.sortIndex })
    .from(spotlightProductVariants)
    .where(eq(spotlightProductVariants.parentProductId, parentProductId))
    .orderBy(desc(spotlightProductVariants.sortIndex))
    .limit(1);
  return (row?.sortIndex ?? -1) + 1;
}

export async function deleteSpotlightVariantsByParentId(
  parentProductId: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(spotlightProductVariants)
    .where(eq(spotlightProductVariants.parentProductId, parentProductId));
}

export async function insertSpotlightVariants(
  parentProductId: string,
  rows: Array<{
    productUrl?: string | null;
    imageUrl?: string | null;
    priceUsdCents?: number | null;
    productSize?: string | null;
    productColor?: string | null;
    packLabel?: string | null;
    label?: string | null;
    sortIndex: number;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  await db.insert(spotlightProductVariants).values(
    rows.map((r) => ({
      parentProductId,
      productUrl: r.productUrl ?? null,
      imageUrl: r.imageUrl ?? null,
      priceUsdCents: r.priceUsdCents ?? null,
      productSize: r.productSize ?? null,
      productColor: r.productColor ?? null,
      packLabel: r.packLabel ?? null,
      label: r.label ?? null,
      sortIndex: r.sortIndex,
      isActive: true,
    })),
  );
  return rows.length;
}
