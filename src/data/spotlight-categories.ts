import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { spotlightCategories, spotlightCategoryProducts } from "@/db/schema";
import {
  DEFAULT_SPOTLIGHT_CATEGORIES,
  isSpotlightCategoryIconName,
  nextSpotlightCategoryGradient,
  slugifySpotlightCategoryTitle,
  type SpotlightCategoryDefinition,
  type SpotlightCategoryIconName,
  type SpotlightCategoryRecord,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { isMissingSpotlightCategoriesTableError } from "@/lib/spotlight-db-safe";

export function defaultSpotlightCategoryRecords(): SpotlightCategoryRecord[] {
  return DEFAULT_SPOTLIGHT_CATEGORIES.map((category, index) => ({
    ...category,
    isActive: true,
    sortIndex: index,
  }));
}

export function defaultSpotlightCategoryPublishedMap(): Record<
  SpotlightCategorySlug,
  boolean
> {
  const map: Record<SpotlightCategorySlug, boolean> = {};
  for (const category of DEFAULT_SPOTLIGHT_CATEGORIES) {
    map[category.slug] = true;
  }
  return map;
}

function mapCategoryRow(
  row: typeof spotlightCategories.$inferSelect,
  fallbackIndex: number,
): SpotlightCategoryRecord {
  const seed = DEFAULT_SPOTLIGHT_CATEGORIES.find((c) => c.slug === row.slug);
  const iconName: SpotlightCategoryIconName = isSpotlightCategoryIconName(
    row.iconName,
  )
    ? row.iconName
    : (seed?.iconName ?? "package");
  return {
    slug: row.slug,
    title: row.title.trim() || seed?.title || row.slug,
    description: row.description.trim() || seed?.description || "",
    tag: row.tag.trim() || seed?.tag || "New",
    priceHint: row.priceHint.trim() || seed?.priceHint || "",
    gradient: row.gradient.trim() || seed?.gradient || nextSpotlightCategoryGradient(fallbackIndex),
    iconName,
    isActive: row.isActive,
    sortIndex: row.sortIndex,
  };
}

function seedInsertValues() {
  return DEFAULT_SPOTLIGHT_CATEGORIES.map((category, index) => ({
    slug: category.slug,
    title: category.title,
    description: category.description,
    tag: category.tag,
    priceHint: category.priceHint,
    gradient: category.gradient,
    iconName: category.iconName,
    sortIndex: index,
    isActive: true,
  }));
}

/** Insert missing default category slugs so Home keeps current behavior. */
export async function ensureSpotlightCategoryRows(): Promise<void> {
  const db = getDb();
  await db
    .insert(spotlightCategories)
    .values(seedInsertValues())
    .onConflictDoNothing({ target: spotlightCategories.slug });

  const existing = await db.select().from(spotlightCategories);
  for (const row of existing) {
    if (row.title.trim()) continue;
    const index = DEFAULT_SPOTLIGHT_CATEGORIES.findIndex((c) => c.slug === row.slug);
    const seed = index >= 0 ? DEFAULT_SPOTLIGHT_CATEGORIES[index] : null;
    if (!seed) continue;
    await db
      .update(spotlightCategories)
      .set({
        title: seed.title,
        description: seed.description,
        tag: seed.tag,
        priceHint: seed.priceHint,
        gradient: seed.gradient,
        iconName: seed.iconName,
        sortIndex: index,
      })
      .where(eq(spotlightCategories.slug, row.slug));
  }
}

export async function listSpotlightCategoryRecords(): Promise<
  SpotlightCategoryRecord[]
> {
  try {
    await ensureSpotlightCategoryRows();
    const db = getDb();
    const rows = await db
      .select()
      .from(spotlightCategories)
      .orderBy(asc(spotlightCategories.sortIndex), asc(spotlightCategories.title));
    if (rows.length === 0) return defaultSpotlightCategoryRecords();
    return rows.map((row, index) => mapCategoryRow(row, index));
  } catch (err) {
    if (isMissingSpotlightCategoriesTableError(err)) {
      return defaultSpotlightCategoryRecords();
    }
    throw err;
  }
}

export async function listSpotlightCategoryDefinitions(): Promise<
  SpotlightCategoryDefinition[]
> {
  const rows = await listSpotlightCategoryRecords();
  return rows.map(
    ({ isActive: _isActive, sortIndex: _sortIndex, ...definition }) =>
      definition,
  );
}

export async function listSpotlightCategoryPublishedFlags(): Promise<
  Record<SpotlightCategorySlug, boolean>
> {
  const rows = await listSpotlightCategoryRecords();
  const flags: Record<SpotlightCategorySlug, boolean> = {};
  for (const row of rows) {
    flags[row.slug] = row.isActive;
  }
  return flags;
}

export async function setSpotlightCategoryPublished(
  slug: SpotlightCategorySlug,
  published: boolean,
): Promise<void> {
  await ensureSpotlightCategoryRows();
  const db = getDb();
  const updated = await db
    .update(spotlightCategories)
    .set({
      isActive: published,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(spotlightCategories.slug, slug))
    .returning({ slug: spotlightCategories.slug });
  if (updated.length === 0) {
    throw new Error("Category not found.");
  }
}

async function uniqueCategorySlug(base: string): Promise<string> {
  const db = getDb();
  let candidate = base;
  let n = 2;
  for (;;) {
    const [existing] = await db
      .select({ slug: spotlightCategories.slug })
      .from(spotlightCategories)
      .where(eq(spotlightCategories.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base.slice(0, 44)}-${n}`;
    n += 1;
  }
}

export async function createSpotlightCategory(input: {
  title: string;
  description: string;
  tag: string;
  iconName: SpotlightCategoryIconName;
}): Promise<SpotlightCategoryRecord> {
  await ensureSpotlightCategoryRows();
  const db = getDb();
  const existing = await db.select().from(spotlightCategories);
  const sortIndex =
    existing.reduce((max, row) => Math.max(max, row.sortIndex), -1) + 1;
  const slug = await uniqueCategorySlug(slugifySpotlightCategoryTitle(input.title));
  const gradient = nextSpotlightCategoryGradient(sortIndex);
  const [row] = await db
    .insert(spotlightCategories)
    .values({
      slug,
      title: input.title,
      description: input.description,
      tag: input.tag,
      priceHint: "",
      gradient,
      iconName: input.iconName,
      sortIndex,
      isActive: false,
    })
    .returning();
  if (!row) {
    throw new Error("Could not create category.");
  }
  return mapCategoryRow(row, sortIndex);
}

export async function deleteSpotlightCategory(
  slug: SpotlightCategorySlug,
): Promise<void> {
  await ensureSpotlightCategoryRows();
  const db = getDb();
  const rows = await db.select({ slug: spotlightCategories.slug }).from(
    spotlightCategories,
  );
  if (rows.length <= 1) {
    throw new Error("Keep at least one spotlight category.");
  }
  const exists = rows.some((row) => row.slug === slug);
  if (!exists) {
    throw new Error("Category not found.");
  }

  await db
    .delete(spotlightCategoryProducts)
    .where(eq(spotlightCategoryProducts.categorySlug, slug));
  await db
    .delete(spotlightCategories)
    .where(eq(spotlightCategories.slug, slug));
}
