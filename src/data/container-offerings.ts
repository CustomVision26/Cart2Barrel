import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerOfferingImages,
  containerOfferings,
  type ContainerOffering,
  type ContainerOfferingImage,
} from "@/db/schema";
import {
  isMissingContainerCatalogSchemaError,
} from "@/lib/db-column-missing";

export type ContainerOfferingWithImages = {
  offering: ContainerOffering;
  images: ContainerOfferingImage[];
};

const CONTAINER_CATALOG_MIGRATION_HINT =
  "Container catalog tables are missing. From the project root run `npm run db:push` or `npm run db:migrate` (see drizzle/0028_container_offerings_cart.sql), then restart the dev server.";

function rethrowIfMissingContainerCatalog(e: unknown): never {
  if (isMissingContainerCatalogSchemaError(e)) {
    throw new Error(CONTAINER_CATALOG_MIGRATION_HINT, { cause: e });
  }
  throw e;
}

async function loadImagesForOfferingIds(
  offeringIds: string[],
): Promise<Map<string, ContainerOfferingImage[]>> {
  const map = new Map<string, ContainerOfferingImage[]>();
  if (offeringIds.length === 0) return map;
  const db = getDb();
  let imgs;
  try {
    imgs = await db
      .select()
      .from(containerOfferingImages)
      .where(inArray(containerOfferingImages.containerOfferingId, offeringIds))
      .orderBy(
        asc(containerOfferingImages.containerOfferingId),
        asc(containerOfferingImages.sortIndex),
      );
  } catch (e) {
    rethrowIfMissingContainerCatalog(e);
  }
  for (const im of imgs) {
    const list = map.get(im.containerOfferingId) ?? [];
    list.push(im);
    map.set(im.containerOfferingId, list);
  }
  return map;
}

/** First catalog image URL per offering (lowest sortIndex), for thumbnails in cart/shipping UI. */
export async function getPrimaryImageUrlByOfferingIds(
  offeringIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(offeringIds.filter(Boolean))];
  const imgMap = await loadImagesForOfferingIds(unique);
  const out = new Map<string, string>();
  for (const id of unique) {
    const url = imgMap.get(id)?.[0]?.imageUrl?.trim();
    if (url) {
      out.set(id, url);
    }
  }
  return out;
}

export async function listActiveContainerOfferingsWithImages(): Promise<
  ContainerOfferingWithImages[]
> {
  const db = getDb();
  let offerings;
  try {
    offerings = await db
      .select()
      .from(containerOfferings)
      .where(eq(containerOfferings.isActive, true))
      .orderBy(asc(containerOfferings.sortIndex), desc(containerOfferings.createdAt));
  } catch (e) {
    rethrowIfMissingContainerCatalog(e);
  }

  const imgMap = await loadImagesForOfferingIds(offerings.map((o) => o.id));
  return offerings.map((offering) => ({
    offering,
    images: imgMap.get(offering.id) ?? [],
  }));
}

export async function listAllContainerOfferingsWithImagesForAdmin(): Promise<
  ContainerOfferingWithImages[]
> {
  const db = getDb();
  let offerings;
  try {
    offerings = await db
      .select()
      .from(containerOfferings)
      .orderBy(asc(containerOfferings.sortIndex), desc(containerOfferings.createdAt));
  } catch (e) {
    rethrowIfMissingContainerCatalog(e);
  }

  const imgMap = await loadImagesForOfferingIds(offerings.map((o) => o.id));
  return offerings.map((offering) => ({
    offering,
    images: imgMap.get(offering.id) ?? [],
  }));
}

export async function getContainerOfferingByIdForAdmin(
  id: string,
): Promise<ContainerOfferingWithImages | null> {
  const db = getDb();
  let offering;
  try {
    [offering] = await db
      .select()
      .from(containerOfferings)
      .where(eq(containerOfferings.id, id))
      .limit(1);
  } catch (e) {
    rethrowIfMissingContainerCatalog(e);
  }
  if (!offering) return null;
  const imgMap = await loadImagesForOfferingIds([offering.id]);
  return { offering, images: imgMap.get(offering.id) ?? [] };
}
