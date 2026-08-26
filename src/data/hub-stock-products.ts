import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  hubStockOrderItems,
  hubStockProductImages,
  hubStockProducts,
  orders,
  type HubStockProduct,
  type HubStockProductImage,
} from "@/db/schema";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { isHubStockProductUrl, parseHubStockProductIdFromUrl } from "@/lib/hub-stock";

export type PublicHubStockProduct = {
  id: string;
  name: string;
  sizeLabel: string;
  colorLabel: string;
  description: string;
  priceUsdCents: number;
  stockQty: number;
  imageUrls: string[];
};

export type HubStockAdminImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

export type HubStockAdminProduct = HubStockProduct & {
  images: HubStockAdminImage[];
};

async function imagesByProductIds(
  productIds: string[],
): Promise<Map<string, HubStockProductImage[]>> {
  const map = new Map<string, HubStockProductImage[]>();
  if (productIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(hubStockProductImages)
    .where(inArray(hubStockProductImages.productId, productIds))
    .orderBy(asc(hubStockProductImages.sortIndex));
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row);
    map.set(row.productId, list);
  }
  return map;
}

export async function listHubStockProductsForAdmin(): Promise<HubStockAdminProduct[]> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const products = await db
    .select()
    .from(hubStockProducts)
    .orderBy(desc(hubStockProducts.createdAt));
  const images = await imagesByProductIds(products.map((p) => p.id));
  return products.map((product) => ({
    ...product,
    images: (images.get(product.id) ?? []).map((im) => ({
      id: im.id,
      imageUrl: im.imageUrl,
      sortIndex: im.sortIndex,
    })),
  }));
}

export async function listActiveHubStockProductsForStorefront(): Promise<
  PublicHubStockProduct[]
> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const rows = await db
    .select({
      id: hubStockProducts.id,
      name: hubStockProducts.name,
      sizeLabel: hubStockProducts.sizeLabel,
      colorLabel: hubStockProducts.colorLabel,
      description: hubStockProducts.description,
      priceUsdCents: hubStockProducts.priceUsdCents,
      stockQty: hubStockProducts.stockQty,
    })
    .from(hubStockProducts)
    .where(
      and(eq(hubStockProducts.isActive, true), sql`${hubStockProducts.stockQty} > 0`),
    )
    .orderBy(desc(hubStockProducts.createdAt));
  const images = await imagesByProductIds(rows.map((p) => p.id));
  return rows.map((row) => ({
    ...row,
    imageUrls: (images.get(row.id) ?? []).map((im) => im.imageUrl),
  }));
}

export async function listHubStockImageUrlsByProductIds(
  productIds: string[],
): Promise<Map<string, string[]>> {
  const images = await imagesByProductIds(productIds);
  const map = new Map<string, string[]>();
  for (const [id, rows] of images) {
    map.set(
      id,
      rows.map((im) => im.imageUrl),
    );
  }
  return map;
}

/** First catalog photo for in-hub requests that were stored without `product_image_url`. */
export async function resolveHubStockDisplayImageUrls(
  requests: {
    id: string;
    productUrl: string;
    productImageUrl?: string | null;
    source?: string | null;
  }[],
): Promise<Map<string, string>> {
  const needImage = requests.filter(
    (row) =>
      !row.productImageUrl?.trim() &&
      (row.source === "hub_stock" || isHubStockProductUrl(row.productUrl)),
  );
  const productIds = [
    ...new Set(
      needImage
        .map((row) => parseHubStockProductIdFromUrl(row.productUrl))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;
  const images = await listHubStockImageUrlsByProductIds(productIds);
  for (const row of needImage) {
    const productId = parseHubStockProductIdFromUrl(row.productUrl);
    const url = productId ? images.get(productId)?.[0]?.trim() : undefined;
    if (url) map.set(row.id, url);
  }
  return map;
}

export async function insertHubStockProductImages(
  productId: string,
  imageUrls: string[],
): Promise<number> {
  if (imageUrls.length === 0) return 0;
  const db = getDb();
  const [maxRow] = await db
    .select({ m: hubStockProductImages.sortIndex })
    .from(hubStockProductImages)
    .where(eq(hubStockProductImages.productId, productId))
    .orderBy(desc(hubStockProductImages.sortIndex))
    .limit(1);
  let nextSort = (maxRow?.m ?? -1) + 1;
  for (const imageUrl of imageUrls) {
    await db.insert(hubStockProductImages).values({
      productId,
      imageUrl,
      sortIndex: nextSort,
    });
    nextSort += 1;
  }
  return imageUrls.length;
}

export async function countHubStockProductImages(productId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(hubStockProductImages)
    .where(eq(hubStockProductImages.productId, productId));
  return Number(row?.n ?? 0);
}

export async function deleteHubStockProductImage(imageId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(hubStockProductImages)
    .where(eq(hubStockProductImages.id, imageId))
    .returning({ id: hubStockProductImages.id });
  return deleted.length > 0;
}

export async function getHubStockProductById(
  productId: string,
): Promise<HubStockProduct | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(hubStockProducts)
    .where(eq(hubStockProducts.id, productId))
    .limit(1);
  return row;
}

export async function createHubStockProduct(input: {
  name: string;
  sizeLabel: string;
  colorLabel: string;
  description: string;
  priceUsdCents: number;
  stockQty: number;
  parcelWeightOz: number;
  parcelLengthIn: number;
  parcelWidthIn: number;
  parcelHeightIn: number;
  isActive: boolean;
  createdByClerkUserId: string;
}): Promise<HubStockProduct> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const now = new Date().toISOString();
  const [created] = await db
    .insert(hubStockProducts)
    .values({
      name: input.name,
      sizeLabel: input.sizeLabel,
      colorLabel: input.colorLabel,
      description: input.description,
      priceUsdCents: input.priceUsdCents,
      stockQty: input.stockQty,
      parcelWeightOz: input.parcelWeightOz,
      parcelLengthIn: input.parcelLengthIn,
      parcelWidthIn: input.parcelWidthIn,
      parcelHeightIn: input.parcelHeightIn,
      isActive: input.isActive,
      createdByClerkUserId: input.createdByClerkUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!created) {
    throw new Error("Could not create in-hub product.");
  }
  return created;
}

export async function setHubStockProductPublished(
  id: string,
  published: boolean,
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(hubStockProducts)
    .set({
      isActive: published,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hubStockProducts.id, id))
    .returning({ id: hubStockProducts.id });
  return updated.length > 0;
}

export async function updateHubStockProduct(input: {
  id: string;
  name: string;
  sizeLabel: string;
  colorLabel: string;
  description: string;
  priceUsdCents: number;
  stockQty: number;
  parcelWeightOz: number;
  parcelLengthIn: number;
  parcelWidthIn: number;
  parcelHeightIn: number;
  isActive: boolean;
}): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(hubStockProducts)
    .set({
      name: input.name,
      sizeLabel: input.sizeLabel,
      colorLabel: input.colorLabel,
      description: input.description,
      priceUsdCents: input.priceUsdCents,
      stockQty: input.stockQty,
      parcelWeightOz: input.parcelWeightOz,
      parcelLengthIn: input.parcelLengthIn,
      parcelWidthIn: input.parcelWidthIn,
      parcelHeightIn: input.parcelHeightIn,
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hubStockProducts.id, input.id))
    .returning({ id: hubStockProducts.id });
  return updated.length > 0;
}

export async function deleteHubStockProduct(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(hubStockProducts)
    .where(eq(hubStockProducts.id, id))
    .returning({ id: hubStockProducts.id });
  return deleted.length > 0;
}

/** Quantity already reserved on pending checkouts for this SKU. */
export async function sumPendingHubStockOrderQty(
  productId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      qty: sql<number>`coalesce(sum(${hubStockOrderItems.quantity}), 0)`,
    })
    .from(hubStockOrderItems)
    .innerJoin(orders, eq(orders.id, hubStockOrderItems.orderId))
    .where(
      and(
        eq(hubStockOrderItems.productId, productId),
        eq(orders.status, "pending"),
      ),
    );
  return Number(row?.qty ?? 0);
}

export async function decrementHubStockForPaidOrder(
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const db = getDb();
  await db
    .update(hubStockProducts)
    .set({
      stockQty: sql`greatest(${hubStockProducts.stockQty} - ${quantity}, 0)`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hubStockProducts.id, productId));
}

export async function restoreHubStockQty(
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const db = getDb();
  await db
    .update(hubStockProducts)
    .set({
      stockQty: sql`${hubStockProducts.stockQty} + ${quantity}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hubStockProducts.id, productId));
}
