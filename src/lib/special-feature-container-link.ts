import { eq, inArray, and, or } from "drizzle-orm";

import { getDb } from "@/db";
import { containerOfferings, specialFeatureOffers } from "@/db/schema";

export type SpecialOfferLinkRef = {
  id: string;
  name: string;
  containerOfferingId: string | null;
};

type Db = ReturnType<typeof getDb>;

type ContainerOfferingRow = {
  id: string;
  name: string;
  kind: string;
  specialFeatureOfferId: string | null;
};

/** Resolve which timed special a suitcase SKU belongs to (FK, legacy id, or name). */
export function resolveSpecialFeatureForContainer<
  T extends { id: string; name: string; containerOfferingId: string | null },
>(
  offering: ContainerOfferingRow,
  specials: T[],
): T | null {
  if (offering.kind !== "suitcase") return null;

  if (offering.specialFeatureOfferId) {
    return specials.find((s) => s.id === offering.specialFeatureOfferId) ?? null;
  }

  const legacy = specials.find((s) => s.containerOfferingId === offering.id);
  if (legacy) return legacy;

  const name = offering.name.trim();
  if (!name) return null;
  const byName = specials.filter((s) => s.name.trim() === name);
  return byName.length === 1 ? (byName[0] ?? null) : null;
}

/** All suitcase catalog SKUs linked to a special (FK, legacy id, or matching name). */
export async function listLinkedContainerIdsForSpecialOffer(
  db: Db,
  offer: SpecialOfferLinkRef,
): Promise<string[]> {
  const conditions = [
    eq(containerOfferings.specialFeatureOfferId, offer.id),
    and(
      eq(containerOfferings.kind, "suitcase"),
      eq(containerOfferings.name, offer.name.trim()),
    ),
  ];
  if (offer.containerOfferingId) {
    conditions.push(eq(containerOfferings.id, offer.containerOfferingId));
  }

  const rows = await db
    .select({ id: containerOfferings.id })
    .from(containerOfferings)
    .where(or(...conditions));

  return [...new Set(rows.map((r) => r.id))];
}

export async function setLinkedContainersActiveForSpecialOffer(
  db: Db,
  offer: SpecialOfferLinkRef,
  isActive: boolean,
): Promise<void> {
  const ids = await listLinkedContainerIdsForSpecialOffer(db, offer);
  if (ids.length === 0) return;
  await db
    .update(containerOfferings)
    .set(
      isActive ?
        { isActive: true, specialFeatureOfferId: offer.id }
      : { isActive: false },
    )
    .where(inArray(containerOfferings.id, ids));
}

export async function unlinkContainersFromSpecialOffer(
  db: Db,
  offerId: string,
): Promise<void> {
  await db
    .update(containerOfferings)
    .set({ specialFeatureOfferId: null })
    .where(eq(containerOfferings.specialFeatureOfferId, offerId));
}

/** Persist FK link on a suitcase SKU when resolved via legacy or name matching. */
export async function ensureContainerSpecialFeatureLink(
  db: Db,
  offeringId: string,
  specialFeatureOfferId: string,
): Promise<void> {
  await db
    .update(containerOfferings)
    .set({ specialFeatureOfferId })
    .where(eq(containerOfferings.id, offeringId));
}
