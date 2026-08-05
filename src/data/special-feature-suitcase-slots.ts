import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerOfferings,
  orderContainerItems,
  orders,
  specialFeatureOffers,
  type SpecialFeatureOffer,
} from "@/db/schema";
import {
  listLinkedContainerIdsForSpecialOffer,
  type SpecialOfferLinkRef,
} from "@/lib/special-feature-container-link";

export type SpecialOfferSlotSummary = {
  capacity: number | null;
  /** Paid + pending checkout reservations. */
  reserved: number;
  paid: number;
  remaining: number | null;
  isFull: boolean;
};

export type OrderStatusForSlotCount = "paid" | "pending";

function specialOfferLinkRef(
  offer: Pick<SpecialFeatureOffer, "id" | "name" | "containerOfferingId">,
): SpecialOfferLinkRef {
  return {
    id: offer.id,
    name: offer.name,
    containerOfferingId: offer.containerOfferingId,
  };
}

async function linkedSuitcaseOfferingIds(
  offer: Pick<SpecialFeatureOffer, "id" | "name" | "containerOfferingId">,
): Promise<string[]> {
  const db = getDb();
  return listLinkedContainerIdsForSpecialOffer(db, specialOfferLinkRef(offer));
}

export async function countSuitcaseSlotsForSpecialOffer(
  offer: Pick<SpecialFeatureOffer, "id" | "name" | "containerOfferingId">,
  statuses: readonly OrderStatusForSlotCount[],
): Promise<number> {
  if (statuses.length === 0) return 0;

  const offeringIds = await linkedSuitcaseOfferingIds(offer);
  if (offeringIds.length === 0) return 0;

  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderContainerItems.quantity}), 0)::int`,
    })
    .from(orderContainerItems)
    .innerJoin(orders, eq(orders.id, orderContainerItems.orderId))
    .where(
      and(
        inArray(orderContainerItems.containerOfferingId, offeringIds),
        inArray(orders.status, [...statuses]),
        eq(orderContainerItems.kindSnapshot, "suitcase"),
      ),
    );

  return Number(row?.total ?? 0);
}

export async function getSpecialOfferSlotSummary(
  offer: Pick<
    SpecialFeatureOffer,
    "id" | "name" | "containerOfferingId" | "suitcaseSlotCapacity"
  >,
): Promise<SpecialOfferSlotSummary> {
  const capacity =
    offer.suitcaseSlotCapacity != null && offer.suitcaseSlotCapacity > 0 ?
      offer.suitcaseSlotCapacity
    : null;

  if (capacity == null) {
    return {
      capacity: null,
      reserved: 0,
      paid: 0,
      remaining: null,
      isFull: false,
    };
  }

  const [paid, reserved] = await Promise.all([
    countSuitcaseSlotsForSpecialOffer(offer, ["paid"]),
    countSuitcaseSlotsForSpecialOffer(offer, ["paid", "pending"]),
  ]);

  const remaining = Math.max(0, capacity - reserved);

  return {
    capacity,
    reserved,
    paid,
    remaining,
    isFull: paid >= capacity || remaining <= 0,
  };
}

export async function getSpecialOfferSlotSummariesByOfferId(
  offers: Pick<
    SpecialFeatureOffer,
    "id" | "name" | "containerOfferingId" | "suitcaseSlotCapacity"
  >[],
): Promise<Map<string, SpecialOfferSlotSummary>> {
  const map = new Map<string, SpecialOfferSlotSummary>();
  await Promise.all(
    offers.map(async (offer) => {
      map.set(offer.id, await getSpecialOfferSlotSummary(offer));
    }),
  );
  return map;
}

/** True when paid slots reached the configured capacity. */
export function isSpecialOfferCapacityReached(
  offer: Pick<SpecialFeatureOffer, "suitcaseSlotCapacity">,
  paidCount: number,
): boolean {
  const capacity = offer.suitcaseSlotCapacity;
  return capacity != null && capacity > 0 && paidCount >= capacity;
}

export async function resolveSpecialFeatureOfferIdForContainerOfferingId(
  offeringId: string,
): Promise<string | null> {
  const db = getDb();
  const [offering] = await db
    .select({
      id: containerOfferings.id,
      name: containerOfferings.name,
      kind: containerOfferings.kind,
      specialFeatureOfferId: containerOfferings.specialFeatureOfferId,
    })
    .from(containerOfferings)
    .where(eq(containerOfferings.id, offeringId))
    .limit(1);

  if (!offering || offering.kind !== "suitcase") return null;
  if (offering.specialFeatureOfferId) return offering.specialFeatureOfferId;

  const activeOffers = await db
    .select({
      id: specialFeatureOffers.id,
      name: specialFeatureOffers.name,
      containerOfferingId: specialFeatureOffers.containerOfferingId,
    })
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.isActive, true));

  for (const offer of activeOffers) {
    if (offer.containerOfferingId === offering.id) return offer.id;
    if (offer.name.trim() === offering.name.trim()) return offer.id;
  }

  return null;
}

export async function validateSpecialOfferSlotAvailabilityForCartLines(
  lines: { offeringId: string; quantity: number }[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const byOffer = new Map<string, number>();

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const offerId = await resolveSpecialFeatureOfferIdForContainerOfferingId(
      line.offeringId,
    );
    if (!offerId) continue;
    byOffer.set(offerId, (byOffer.get(offerId) ?? 0) + line.quantity);
  }

  if (byOffer.size === 0) return { ok: true };

  const db = getDb();
  const offerIds = [...byOffer.keys()];
  const offerRows = await db
    .select()
    .from(specialFeatureOffers)
    .where(inArray(specialFeatureOffers.id, offerIds));

  for (const offer of offerRows) {
    const requested = byOffer.get(offer.id) ?? 0;
    if (requested <= 0) continue;

    const summary = await getSpecialOfferSlotSummary(offer);
    if (summary.capacity == null || summary.remaining == null) continue;

    if (requested > summary.remaining) {
      const remainingLabel =
        summary.remaining === 0 ?
          "no suitcase slots remain"
        : `only ${summary.remaining} slot${summary.remaining === 1 ? "" : "s"} remain`;
      return {
        ok: false,
        message: `${offer.name.trim()} has ${remainingLabel} (${summary.capacity} total). Reduce suitcase quantity or try again later.`,
      };
    }
  }

  return { ok: true };
}

/** End a live special when paid suitcase slots reach capacity. */
export async function finalizeSpecialOfferIfCapacityReached(
  offerId: string,
): Promise<boolean> {
  const db = getDb();
  const [offer] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, offerId))
    .limit(1);

  if (!offer || !offer.isActive) return false;
  if (offer.suitcaseSlotCapacity == null || offer.suitcaseSlotCapacity <= 0) {
    return false;
  }

  const paidCount = await countSuitcaseSlotsForSpecialOffer(offer, ["paid"]);
  if (!isSpecialOfferCapacityReached(offer, paidCount)) return false;

  const nowIso = new Date().toISOString();
  await db
    .update(specialFeatureOffers)
    .set({ endsAt: nowIso })
    .where(eq(specialFeatureOffers.id, offer.id));

  const { setLinkedContainersActiveForSpecialOffer } = await import(
    "@/lib/special-feature-container-link"
  );
  await setLinkedContainersActiveForSpecialOffer(
    db,
    specialOfferLinkRef(offer),
    false,
  );

  return true;
}

/** After a paid order, end any linked specials that hit their slot capacity. */
export async function finalizeSpecialOffersForPaidOrder(
  orderId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      containerOfferingId: orderContainerItems.containerOfferingId,
    })
    .from(orderContainerItems)
    .where(
      and(
        eq(orderContainerItems.orderId, orderId),
        eq(orderContainerItems.kindSnapshot, "suitcase"),
      ),
    );

  const offerIds = new Set<string>();
  for (const row of rows) {
    if (!row.containerOfferingId) continue;
    const offerId = await resolveSpecialFeatureOfferIdForContainerOfferingId(
      row.containerOfferingId,
    );
    if (offerId) offerIds.add(offerId);
  }

  for (const offerId of offerIds) {
    await finalizeSpecialOfferIfCapacityReached(offerId);
  }
}
