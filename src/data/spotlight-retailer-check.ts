import { eq, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { spotlightCategoryProducts } from "@/db/schema";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { withSerpApiUsage } from "@/lib/serpapi/usage-context";
import {
  compareSpotlightRetailerDrift,
  fetchSpotlightRetailerLiveSnapshot,
  type SpotlightRetailerDriftField,
} from "@/lib/spotlight/spotlight-retailer-live-check";

const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 8;
const DEFAULT_CONCURRENCY = 3;

export type SpotlightRetailerCheckSave = {
  retailerCheckedAt: string;
  retailerCheckError: string | null;
  retailerDriftFields: SpotlightRetailerDriftField[] | null;
  retailerLivePriceUsdCents: number | null;
  retailerLiveProductUrl: string | null;
  retailerLiveLabel: string | null;
};

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  });
  await Promise.all(workers);
}

export async function saveSpotlightRetailerCheck(
  id: string,
  patch: SpotlightRetailerCheckSave,
): Promise<void> {
  const db = getDb();
  await db
    .update(spotlightCategoryProducts)
    .set({
      retailerCheckedAt: patch.retailerCheckedAt,
      retailerCheckError: patch.retailerCheckError,
      retailerDriftFields: patch.retailerDriftFields,
      retailerLivePriceUsdCents: patch.retailerLivePriceUsdCents,
      retailerLiveProductUrl: patch.retailerLiveProductUrl,
      retailerLiveLabel: patch.retailerLiveLabel,
    })
    .where(eq(spotlightCategoryProducts.id, id));
}

export async function clearSpotlightRetailerDrift(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(spotlightCategoryProducts)
    .set({
      retailerDriftFields: null,
      retailerCheckError: null,
    })
    .where(eq(spotlightCategoryProducts.id, id));
}

export async function listStaleSpotlightProductsForRetailerCheck(options?: {
  limit?: number;
  staleMs?: number;
}): Promise<
  Array<{
    id: string;
    productUrl: string;
    priceUsdCents: number | null;
    label: string | null;
    imageUrl: string | null;
  }>
> {
  const limit = Math.max(1, Math.min(40, options?.limit ?? DEFAULT_LIMIT));
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const db = getDb();
  const rows = await db
    .select({
      id: spotlightCategoryProducts.id,
      productUrl: spotlightCategoryProducts.productUrl,
      priceUsdCents: spotlightCategoryProducts.priceUsdCents,
      label: spotlightCategoryProducts.label,
      imageUrl: spotlightCategoryProducts.imageUrl,
    })
    .from(spotlightCategoryProducts)
    .where(
      or(
        isNull(spotlightCategoryProducts.retailerCheckedAt),
        lt(spotlightCategoryProducts.retailerCheckedAt, cutoff),
      ),
    )
    .orderBy(sql`${spotlightCategoryProducts.retailerCheckedAt} ASC NULLS FIRST`)
    .limit(limit);
  return rows;
}

async function checkOneSpotlightProduct(row: {
  id: string;
  productUrl: string;
  priceUsdCents: number | null;
  label: string | null;
  imageUrl: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  try {
    const live = await fetchSpotlightRetailerLiveSnapshot(row.productUrl);
    const driftFields = compareSpotlightRetailerDrift(
      {
        productUrl: row.productUrl,
        priceUsdCents: row.priceUsdCents,
        label: row.label,
        imageUrl: row.imageUrl,
      },
      live,
    );
    await saveSpotlightRetailerCheck(row.id, {
      retailerCheckedAt: now,
      retailerCheckError: null,
      retailerDriftFields: driftFields.length > 0 ? driftFields : null,
      retailerLivePriceUsdCents: live.priceUsdCents,
      retailerLiveProductUrl: live.productUrl,
      retailerLiveLabel: live.label,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Retailer lookup failed.";
    await saveSpotlightRetailerCheck(row.id, {
      retailerCheckedAt: now,
      retailerCheckError: message.slice(0, 400),
      retailerDriftFields: ["unavailable"],
      retailerLivePriceUsdCents: null,
      retailerLiveProductUrl: null,
      retailerLiveLabel: null,
    });
  }
}

/** Refresh stale spotlight rows against the live retailer listing (SerpApi). */
export async function refreshStaleSpotlightRetailerChecks(options?: {
  limit?: number;
  staleMs?: number;
  concurrency?: number;
}): Promise<{ checked: number; skipped: boolean }> {
  if (!getSerpApiKey()) {
    return { checked: 0, skipped: true };
  }
  const stale = await listStaleSpotlightProductsForRetailerCheck(options);
  if (stale.length === 0) {
    return { checked: 0, skipped: false };
  }
  const concurrency = Math.max(
    1,
    Math.min(6, options?.concurrency ?? DEFAULT_CONCURRENCY),
  );
  await withSerpApiUsage({ userId: null, source: "retailer_check" }, () =>
    mapPool(stale, concurrency, checkOneSpotlightProduct),
  );
  return { checked: stale.length, skipped: false };
}
