import "server-only";

import { asc, eq } from "drizzle-orm";

import { ensureStarterBundlesSchema } from "@/data/ensure-starter-bundles-schema";
import { getDb } from "@/db";
import {
  starterBundleItems,
  starterBundles,
  type StarterBundle,
  type StarterBundleItem,
} from "@/db/schema";
import {
  starterBundleLineTotalCents,
  starterBundleMerchandiseSubtotalCents,
  type StarterBundleSnapshot,
  type StarterBundleSnapshotItem,
  type StarterBundleStatus,
} from "@/lib/starter-bundles";
import type {
  AdminSaveStarterBundleInput,
  StarterBundleItemInput,
} from "@/lib/validations/starter-bundle";

export type StarterBundleWithItems = {
  bundle: StarterBundle;
  items: StarterBundleItem[];
  merchandiseSubtotalCents: number;
};

export type PublishedStarterBundleCard = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  barrelSize: string | null;
  barrelFillLevel: string | null;
  updatedAt: string;
  merchandiseSubtotalCents: number;
  itemCount: number;
};

export type PublishedStarterBundleDetail = PublishedStarterBundleCard & {
  items: {
    id: string;
    sortIndex: number;
    productName: string;
    quantity: number;
    estimatedUnitPriceCents: number;
    productSize: string | null;
    productColor: string | null;
    retailerUrl: string | null;
    lineTotalCents: number;
  }[];
};

function merchandiseSubtotalForItems(items: StarterBundleItem[]): number {
  return starterBundleMerchandiseSubtotalCents(items);
}

function snapshotItemsFromRows(
  items: StarterBundleItem[],
): StarterBundleSnapshotItem[] {
  return items.map((item) => ({
    sortIndex: item.sortIndex,
    productName: item.productName,
    quantity: item.quantity,
    estimatedUnitPriceCents: item.estimatedUnitPriceCents,
    productSize: item.productSize,
    productColor: item.productColor,
    retailerUrl: item.retailerUrl,
    lineTotalCents: starterBundleLineTotalCents(
      item.quantity,
      item.estimatedUnitPriceCents,
    ),
  }));
}

export function starterBundleSnapshotFromRecord(
  bundle: StarterBundle,
  items: StarterBundleItem[],
): StarterBundleSnapshot {
  const snapshotItems = snapshotItemsFromRows(items);
  return {
    bundleId: bundle.id,
    name: bundle.name,
    description: bundle.description,
    imageUrl: bundle.imageUrl,
    barrelSize: bundle.barrelSize,
    barrelFillLevel: bundle.barrelFillLevel,
    updatedAt: bundle.updatedAt,
    merchandiseSubtotalCents: starterBundleMerchandiseSubtotalCents(snapshotItems),
    items: snapshotItems,
  };
}

async function loadItemsForBundle(bundleId: string): Promise<StarterBundleItem[]> {
  const db = getDb();
  return db
    .select()
    .from(starterBundleItems)
    .where(eq(starterBundleItems.starterBundleId, bundleId))
    .orderBy(asc(starterBundleItems.sortIndex));
}

function withItems(
  bundle: StarterBundle,
  items: StarterBundleItem[],
): StarterBundleWithItems {
  return {
    bundle,
    items,
    merchandiseSubtotalCents: merchandiseSubtotalForItems(items),
  };
}

export async function listStarterBundlesForAdmin(): Promise<StarterBundleWithItems[]> {
  const ready = await ensureStarterBundlesSchema();
  if (!ready) return [];
  const db = getDb();
  const bundles = await db
    .select()
    .from(starterBundles)
    .orderBy(asc(starterBundles.createdAt));
  const itemsByBundle = new Map<string, StarterBundleItem[]>();
  if (bundles.length > 0) {
    const rows = await db
      .select()
      .from(starterBundleItems)
      .orderBy(asc(starterBundleItems.sortIndex));
    for (const row of rows) {
      const current = itemsByBundle.get(row.starterBundleId) ?? [];
      current.push(row);
      itemsByBundle.set(row.starterBundleId, current);
    }
  }
  return bundles.map((bundle) =>
    withItems(bundle, itemsByBundle.get(bundle.id) ?? []),
  );
}

export async function getStarterBundleById(
  id: string,
): Promise<StarterBundleWithItems | null> {
  const ready = await ensureStarterBundlesSchema();
  if (!ready) return null;
  const db = getDb();
  const [bundle] = await db
    .select()
    .from(starterBundles)
    .where(eq(starterBundles.id, id))
    .limit(1);
  if (!bundle) return null;
  const items = await loadItemsForBundle(id);
  return withItems(bundle, items);
}

function toPublishedCard(
  bundle: StarterBundle,
  items: StarterBundleItem[],
): PublishedStarterBundleCard {
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    imageUrl: bundle.imageUrl,
    barrelSize: bundle.barrelSize,
    barrelFillLevel: bundle.barrelFillLevel,
    updatedAt: bundle.updatedAt,
    merchandiseSubtotalCents: merchandiseSubtotalForItems(items),
    itemCount: items.length,
  };
}

export async function listPublishedStarterBundles(): Promise<
  PublishedStarterBundleCard[]
> {
  const ready = await ensureStarterBundlesSchema();
  if (!ready) return [];
  const db = getDb();
  const bundles = await db
    .select()
    .from(starterBundles)
    .where(eq(starterBundles.status, "published"));
  if (bundles.length === 0) return [];
  const itemsByBundle = new Map<string, StarterBundleItem[]>();
  const rows = await db
    .select()
    .from(starterBundleItems)
    .orderBy(asc(starterBundleItems.sortIndex));
  for (const row of rows) {
    if (!bundles.some((bundle) => bundle.id === row.starterBundleId)) continue;
    const current = itemsByBundle.get(row.starterBundleId) ?? [];
    current.push(row);
    itemsByBundle.set(row.starterBundleId, current);
  }
  return bundles
    .map((bundle) => toPublishedCard(bundle, itemsByBundle.get(bundle.id) ?? []))
    .sort(
      (a, b) => a.merchandiseSubtotalCents - b.merchandiseSubtotalCents,
    );
}

export async function getPublishedStarterBundleDetail(
  id: string,
): Promise<PublishedStarterBundleDetail | null> {
  const record = await getStarterBundleById(id);
  if (!record || record.bundle.status !== "published") return null;
  const card = toPublishedCard(record.bundle, record.items);
  return {
    ...card,
    items: record.items.map((item) => ({
      id: item.id,
      sortIndex: item.sortIndex,
      productName: item.productName,
      quantity: item.quantity,
      estimatedUnitPriceCents: item.estimatedUnitPriceCents,
      productSize: item.productSize,
      productColor: item.productColor,
      retailerUrl: item.retailerUrl,
      lineTotalCents: starterBundleLineTotalCents(
        item.quantity,
        item.estimatedUnitPriceCents,
      ),
    })),
  };
}

export async function getStarterBundleDetailForViewer(params: {
  id: string;
  allowUnpublishedPreview: boolean;
}): Promise<
  | { ok: true; detail: PublishedStarterBundleDetail; status: StarterBundleStatus }
  | { ok: false; reason: "missing" | "archived" | "unpublished" }
> {
  const record = await getStarterBundleById(params.id);
  if (!record) return { ok: false, reason: "missing" };
  const status = record.bundle.status as StarterBundleStatus;
  if (status === "archived") return { ok: false, reason: "archived" };
  if (status !== "published" && !params.allowUnpublishedPreview) {
    return { ok: false, reason: "unpublished" };
  }
  const card = toPublishedCard(record.bundle, record.items);
  return {
    ok: true,
    status,
    detail: {
      ...card,
      items: record.items.map((item) => ({
        id: item.id,
        sortIndex: item.sortIndex,
        productName: item.productName,
        quantity: item.quantity,
        estimatedUnitPriceCents: item.estimatedUnitPriceCents,
        productSize: item.productSize,
        productColor: item.productColor,
        retailerUrl: item.retailerUrl,
        lineTotalCents: starterBundleLineTotalCents(
          item.quantity,
          item.estimatedUnitPriceCents,
        ),
      })),
    },
  };
}

function replaceItemRows(
  items: StarterBundleItemInput[],
): {
  sortIndex: number;
  productName: string;
  quantity: number;
  estimatedUnitPriceCents: number;
  productSize: string | null;
  productColor: string | null;
  retailerUrl: string | null;
}[] {
  return items.map((item, index) => ({
    sortIndex: index,
    productName: item.productName.trim(),
    quantity: item.quantity,
    estimatedUnitPriceCents: item.estimatedUnitPriceCents,
    productSize: item.productSize?.trim() || null,
    productColor: item.productColor?.trim() || null,
    retailerUrl: item.retailerUrl?.trim() || null,
  }));
}

async function replaceBundleItems(
  bundleId: string,
  items: StarterBundleItemInput[],
): Promise<void> {
  const db = getDb();
  await db
    .delete(starterBundleItems)
    .where(eq(starterBundleItems.starterBundleId, bundleId));
  const rows = replaceItemRows(items);
  for (const row of rows) {
    await db.insert(starterBundleItems).values({
      starterBundleId: bundleId,
      ...row,
    });
  }
}

export async function saveStarterBundleDraft(params: {
  clerkUserId: string;
  input: AdminSaveStarterBundleInput;
}): Promise<StarterBundleWithItems> {
  await ensureStarterBundlesSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const fields = {
    name: params.input.name.trim(),
    description: params.input.description.trim(),
    imageUrl: params.input.imageUrl?.trim() || null,
    barrelSize: params.input.barrelSize?.trim() || null,
    barrelFillLevel: params.input.barrelFillLevel?.trim() || null,
    updatedAt: now,
  };

  if (params.input.id) {
    const existing = await getStarterBundleById(params.input.id);
    if (!existing) throw new Error("Bundle not found.");
    await db
      .update(starterBundles)
      .set({
        ...fields,
        status: "draft",
        publishedAt: null,
      })
      .where(eq(starterBundles.id, params.input.id));
    await replaceBundleItems(params.input.id, params.input.items);
    const saved = await getStarterBundleById(params.input.id);
    if (!saved) throw new Error("Could not save this bundle.");
    return saved;
  }

  const [created] = await db
    .insert(starterBundles)
    .values({
      ...fields,
      status: "draft",
      createdByClerkUserId: params.clerkUserId,
    })
    .returning();
  if (!created) throw new Error("Could not create this bundle.");
  await replaceBundleItems(created.id, params.input.items);
  const saved = await getStarterBundleById(created.id);
  if (!saved) throw new Error("Could not create this bundle.");
  return saved;
}

export async function publishStarterBundle(params: {
  clerkUserId: string;
  input: AdminSaveStarterBundleInput;
}): Promise<StarterBundleWithItems> {
  if (params.input.items.length === 0) {
    throw new Error("Add at least one product before publishing.");
  }
  await ensureStarterBundlesSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const fields = {
    name: params.input.name.trim(),
    description: params.input.description.trim(),
    imageUrl: params.input.imageUrl?.trim() || null,
    barrelSize: params.input.barrelSize?.trim() || null,
    barrelFillLevel: params.input.barrelFillLevel?.trim() || null,
    status: "published" as const,
    publishedAt: now,
    updatedAt: now,
  };

  if (params.input.id) {
    const existing = await getStarterBundleById(params.input.id);
    if (!existing) throw new Error("Bundle not found.");
    await db
      .update(starterBundles)
      .set(fields)
      .where(eq(starterBundles.id, params.input.id));
    await replaceBundleItems(params.input.id, params.input.items);
    const saved = await getStarterBundleById(params.input.id);
    if (!saved) throw new Error("Could not publish this bundle.");
    return saved;
  }

  const [created] = await db
    .insert(starterBundles)
    .values({
      ...fields,
      createdByClerkUserId: params.clerkUserId,
    })
    .returning();
  if (!created) throw new Error("Could not publish this bundle.");
  await replaceBundleItems(created.id, params.input.items);
  const saved = await getStarterBundleById(created.id);
  if (!saved) throw new Error("Could not publish this bundle.");
  return saved;
}

export async function archiveStarterBundle(
  id: string,
): Promise<StarterBundleWithItems> {
  await ensureStarterBundlesSchema();
  const existing = await getStarterBundleById(id);
  if (!existing) throw new Error("Bundle not found.");
  const db = getDb();
  await db
    .update(starterBundles)
    .set({
      status: "archived",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(starterBundles.id, id));
  const saved = await getStarterBundleById(id);
  if (!saved) throw new Error("Could not archive this bundle.");
  return saved;
}

export function timestampsMatch(
  savedUpdatedAt: string,
  submittedUpdatedAt: string,
): boolean {
  const saved = Date.parse(savedUpdatedAt);
  const submitted = Date.parse(submittedUpdatedAt);
  if (Number.isFinite(saved) && Number.isFinite(submitted)) {
    return saved === submitted;
  }
  return savedUpdatedAt === submittedUpdatedAt;
}
