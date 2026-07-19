import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerOfferingImages,
  containerOfferings,
  specialFeatureOffers,
  type ContainerOffering,
  type SpecialFeatureOffer,
} from "@/db/schema";
import { resolveSpecialFeatureForContainer } from "@/lib/special-feature-container-link";

export type SpecialFeatureOfferRow = SpecialFeatureOffer;

export type SpecialFeatureWindowStatus = "Draft" | "Scheduled" | "Live" | "Ended";

export type SpecialFeatureContainerFormRef = {
  id: string;
  name: string;
  status: Exclude<SpecialFeatureWindowStatus, "Ended">;
  priceUsdCents: number;
};

export function getSpecialFeatureWindowStatus(
  startsAt: string,
  endsAt: string,
  isActive: boolean,
): SpecialFeatureWindowStatus {
  if (!isActive) return "Draft";
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Scheduled";
  if (now < start) return "Scheduled";
  if (now > end) return "Ended";
  return "Live";
}

const SPECIAL_FEATURE_STATUS_PRIORITY: Record<
  Exclude<SpecialFeatureWindowStatus, "Ended">,
  number
> = {
  Live: 0,
  Scheduled: 1,
  Draft: 2,
};

/** Draft, scheduled, or live specials for the shipping-containers new form (one row per name). */
export function listEligibleSpecialFeatureRefsForContainerForm(
  offers: SpecialFeatureOfferRow[],
): SpecialFeatureContainerFormRef[] {
  const byName = new Map<
    string,
    SpecialFeatureContainerFormRef & { priority: number }
  >();

  for (const offer of offers) {
    const status = getSpecialFeatureWindowStatus(
      offer.startsAt,
      offer.endsAt,
      offer.isActive,
    );
    if (status === "Ended") continue;

    const name = offer.name.trim();
    if (!name) continue;

    const priority = SPECIAL_FEATURE_STATUS_PRIORITY[status];
    const existing = byName.get(name);
    if (!existing || priority < existing.priority) {
      byName.set(name, {
        id: offer.id,
        name,
        status,
        priceUsdCents: offer.priceUsdCents,
        priority,
      });
    }
  }

  return Array.from(byName.values())
    .sort(
      (a, b) =>
        a.priority - b.priority || a.name.localeCompare(b.name),
    )
    .map(({ id, name, status, priceUsdCents }) => ({
      id,
      name,
      status,
      priceUsdCents,
    }));
}

/** Admin catalog: all specials, newest first. */
export async function listSpecialFeatureOffersForAdmin(): Promise<
  SpecialFeatureOfferRow[]
> {
  const db = getDb();
  try {
    return await db
      .select()
      .from(specialFeatureOffers)
      .orderBy(desc(specialFeatureOffers.createdAt));
  } catch {
    return [];
  }
}

/**
 * Offers that are enabled and currently inside their start/end window.
 * Used for the sitewide promo banner and `/dashboard/barrels` suitcase cards.
 */
export async function listCurrentlyActiveSpecialFeatureOffers(): Promise<
  SpecialFeatureOfferRow[]
> {
  const db = getDb();
  try {
    return await db
      .select()
      .from(specialFeatureOffers)
      .where(
        and(
          eq(specialFeatureOffers.isActive, true),
          lte(specialFeatureOffers.startsAt, sql`now()`),
          gte(specialFeatureOffers.endsAt, sql`now()`),
        ),
      )
      .orderBy(asc(specialFeatureOffers.endsAt));
  } catch {
    return [];
  }
}

/** First currently active special (for a single banner). */
export async function getPrimaryActiveSpecialFeatureOffer(): Promise<SpecialFeatureOfferRow | null> {
  const rows = await listCurrentlyActiveSpecialFeatureOffers();
  return rows[0] ?? null;
}

export async function getSpecialFeatureOfferByIdForAdmin(
  id: string,
): Promise<SpecialFeatureOfferRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, id))
    .limit(1);
  return row ?? null;
}

export type ActiveSpecialFeatureSuitcaseForBarrels = {
  offer: SpecialFeatureOfferRow;
  offering: {
    id: string;
    name: string;
    sizeLabel: string;
    kind: "suitcase";
    priceUsdCents: number;
    isActive: boolean;
  } | null;
  images: {
    id: string;
    imageUrl: string;
    sortIndex: number;
  }[];
};

/** Suitcases to show on `/dashboard/barrels` during an active special. */
export async function listActiveSpecialFeatureSuitcasesForBarrels(): Promise<
  ActiveSpecialFeatureSuitcaseForBarrels[]
> {
  const offers = await listCurrentlyActiveSpecialFeatureOffers();
  if (offers.length === 0) return [];

  const db = getDb();
  const offerIds = offers.map((o) => o.id);
  const legacyOfferingIds = offers
    .map((o) => o.containerOfferingId)
    .filter((id): id is string => Boolean(id));

  type LinkedOffering = {
    id: string;
    name: string;
    sizeLabel: string;
    kind: "suitcase";
    priceUsdCents: number;
    isActive: boolean;
    specialFeatureOfferId: string | null;
  };

  const linkedOfferings: LinkedOffering[] = [];
  try {
    const offerNames = [...new Set(offers.map((o) => o.name.trim()).filter(Boolean))];
    const conditions = [inArray(containerOfferings.specialFeatureOfferId, offerIds)];
    if (legacyOfferingIds.length > 0) {
      conditions.push(inArray(containerOfferings.id, legacyOfferingIds));
    }
    if (offerNames.length > 0) {
      conditions.push(
        and(
          eq(containerOfferings.kind, "suitcase"),
          inArray(containerOfferings.name, offerNames),
        ),
      );
    }

    const rows = await db
      .select({
        id: containerOfferings.id,
        name: containerOfferings.name,
        sizeLabel: containerOfferings.sizeLabel,
        kind: containerOfferings.kind,
        priceUsdCents: containerOfferings.priceUsdCents,
        isActive: containerOfferings.isActive,
        specialFeatureOfferId: containerOfferings.specialFeatureOfferId,
      })
      .from(containerOfferings)
      .where(
        and(
          eq(containerOfferings.kind, "suitcase"),
          eq(containerOfferings.isActive, true),
          or(...conditions),
        ),
      );

    for (const r of rows) {
      if (r.kind !== "suitcase") continue;
      linkedOfferings.push({
        id: r.id,
        name: r.name,
        sizeLabel: r.sizeLabel,
        kind: "suitcase",
        priceUsdCents: r.priceUsdCents,
        isActive: r.isActive,
        specialFeatureOfferId: r.specialFeatureOfferId,
      });
    }
  } catch {
    // catalog missing
  }

  const offeringIds = linkedOfferings.map((o) => o.id);

  const imagesByOfferingId = new Map<
    string,
    { id: string; imageUrl: string; sortIndex: number }[]
  >();
  if (offeringIds.length > 0) {
    try {
      const imgs = await db
        .select({
          id: containerOfferingImages.id,
          imageUrl: containerOfferingImages.imageUrl,
          sortIndex: containerOfferingImages.sortIndex,
          containerOfferingId: containerOfferingImages.containerOfferingId,
        })
        .from(containerOfferingImages)
        .where(inArray(containerOfferingImages.containerOfferingId, offeringIds))
        .orderBy(
          asc(containerOfferingImages.containerOfferingId),
          asc(containerOfferingImages.sortIndex),
        );
      for (const im of imgs) {
        const list = imagesByOfferingId.get(im.containerOfferingId) ?? [];
        list.push({
          id: im.id,
          imageUrl: im.imageUrl,
          sortIndex: im.sortIndex,
        });
        imagesByOfferingId.set(im.containerOfferingId, list);
      }
    } catch {
      // images missing
    }
  }

  const results: ActiveSpecialFeatureSuitcaseForBarrels[] = [];

  for (const offer of offers) {
    const matched = linkedOfferings.filter(
      (o) =>
        o.specialFeatureOfferId === offer.id ||
        o.id === offer.containerOfferingId ||
        o.name.trim() === offer.name.trim(),
    );
    const seen = new Set<string>();
    const uniqueMatched = matched.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    if (offer.packagingMode === "outside" || uniqueMatched.length === 0) {
      results.push({
        offer,
        offering: null,
        images: [],
      });
      continue;
    }

    for (const offering of uniqueMatched) {
      results.push({
        offer,
        offering: {
          id: offering.id,
          name: offering.name,
          sizeLabel: offering.sizeLabel,
          kind: offering.kind,
          priceUsdCents: offering.priceUsdCents,
          isActive: offering.isActive,
        },
        images: imagesByOfferingId.get(offering.id) ?? [],
      });
    }
  }

  return results;
}

type ContainerOfferingTransportLookup = Pick<
  ContainerOffering,
  "id" | "name" | "kind" | "specialFeatureOfferId"
>;

export type SpecialFeatureCartPricing = {
  transportationFeeUnitCents: number;
  airlineName: string;
  airlineSecondBagUsdCents: number;
  airlineThirdBagUsdCents: number;
};

/** In-app special pricing metadata for cart / checkout (per offering id). */
export async function getSpecialFeatureCartPricingByOfferingIds(
  offerings: ContainerOfferingTransportLookup[],
): Promise<Map<string, SpecialFeatureCartPricing>> {
  const suitcaseOfferings = offerings.filter((o) => o.kind === "suitcase");
  if (suitcaseOfferings.length === 0) return new Map();

  const db = getDb();
  let specials: SpecialFeatureOfferRow[] = [];
  try {
    specials = await db.select().from(specialFeatureOffers);
  } catch {
    return new Map();
  }

  const out = new Map<string, SpecialFeatureCartPricing>();
  for (const offering of suitcaseOfferings) {
    const special = resolveSpecialFeatureForContainer(
      {
        id: offering.id,
        name: offering.name,
        kind: offering.kind,
        specialFeatureOfferId: offering.specialFeatureOfferId,
      },
      specials,
    );
    if (!special || special.packagingMode !== "in_app") continue;
    out.set(offering.id, {
      transportationFeeUnitCents: special.priceUsdCents,
      airlineName: special.airlineName.trim(),
      airlineSecondBagUsdCents: special.airlineSecondBagUsdCents,
      airlineThirdBagUsdCents: special.airlineThirdBagUsdCents,
    });
  }
  return out;
}

/** In-app special transportation fee (USD cents per unit) for cart / checkout. */
export async function getSpecialFeatureTransportationFeeUnitCentsByOfferingIds(
  offerings: ContainerOfferingTransportLookup[],
): Promise<Map<string, number>> {
  const pricing = await getSpecialFeatureCartPricingByOfferingIds(offerings);
  const out = new Map<string, number>();
  for (const [id, row] of pricing) {
    if (row.transportationFeeUnitCents > 0) {
      out.set(id, row.transportationFeeUnitCents);
    }
  }
  return out;
}
