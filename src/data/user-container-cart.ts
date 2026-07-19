import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerOfferingImages,
  containerOfferings,
  userContainerCartLines,
  type ContainerOffering,
  type ContainerOfferingImage,
  type OrderContainerItem,
} from "@/db/schema";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";
import {
  allocateSpecialFeatureAirlineBaggageFees,
  SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY,
  type SpecialSuitcaseBaggageAllocationLine,
} from "@/lib/special-feature-bag-fees";
import {
  getSpecialFeatureCartPricingByOfferingIds,
  type SpecialFeatureCartPricing,
} from "@/data/special-feature-offers";

type SpecialSuitcaseOfferingLookup = Pick<
  ContainerOffering,
  "id" | "name" | "kind" | "specialFeatureOfferId"
>;

/** Total in-app special suitcase quantity in the user's container cart. */
export async function sumUserSpecialSuitcaseCartQuantity(
  clerkUserId: string,
  options?: {
    /** Replace one line's qty when summing (including lines not yet in cart). */
    setOfferingId?: string;
    setQuantity?: number;
    /** Offerings to include in pricing lookup when not already in the cart. */
    extraOfferingsForPricing?: SpecialSuitcaseOfferingLookup[];
  },
): Promise<number> {
  const rows = await listUserContainerCartWithOfferings(clerkUserId);

  const offeringsById = new Map<string, SpecialSuitcaseOfferingLookup>();
  for (const row of rows) {
    offeringsById.set(row.offering.id, row.offering);
  }
  for (const offering of options?.extraOfferingsForPricing ?? []) {
    offeringsById.set(offering.id, offering);
  }

  const pricingByOfferingId = await getSpecialFeatureCartPricingByOfferingIds([
    ...offeringsById.values(),
  ]);

  let total = 0;
  const countedOfferingIds = new Set<string>();

  for (const row of rows) {
    if (!pricingByOfferingId.has(row.offering.id)) continue;
    countedOfferingIds.add(row.offering.id);
    const qty =
      options?.setOfferingId === row.offering.id ?
        (options.setQuantity ?? 0)
      : row.quantity;
    if (qty > 0) total += qty;
  }

  if (
    options?.setOfferingId &&
    !countedOfferingIds.has(options.setOfferingId) &&
    pricingByOfferingId.has(options.setOfferingId)
  ) {
    const qty = options.setQuantity ?? 0;
    if (qty > 0) total += qty;
  }

  return total;
}

/** Sum special suitcase qty from cart rows when special offering ids are known. */
export function sumSpecialSuitcaseCartQuantityFromRows(
  rows: { offeringId: string; quantity: number }[],
  specialOfferingIds: ReadonlySet<string>,
): number {
  let total = 0;
  for (const row of rows) {
    if (!specialOfferingIds.has(row.offeringId) || row.quantity <= 0) continue;
    total += row.quantity;
  }
  return total;
}

export type ContainerCheckoutLine = {
  offeringId: string;
  name: string;
  sizeLabel: string;
  kind: ContainerOfferingKind;
  quantity: number;
  unitPriceCents: number;
  /** Container catalog subtotal (unit × qty). */
  lineTotalCents: number;
  /** Timed special transportation fee per unit (0 when not applicable). */
  transportationFeeUnitCents: number;
  /** Transportation fee subtotal (unit × qty). */
  transportationFeeCents: number;
  airlineName: string;
  airlineSecondBagUsdCents: number;
  airlineThirdBagUsdCents: number;
  airlineBaggageFeeCents: number;
  airlineBaggageFeeDetail: string;
  cartLineAddedAt: string | null;
};

export type UserContainerCartRow = {
  cartLineId: string;
  quantity: number;
  /** Stable first-add timestamp for special suitcase bag-slot ordering. */
  addedAt: string;
  offering: ContainerOffering;
  images: ContainerOfferingImage[];
};

export function buildSpecialSuitcaseBaggageAllocation(
  rows: Array<{ offeringId: string; quantity: number; addedAt: string }>,
  pricingByOfferingId: Map<string, SpecialFeatureCartPricing>,
): Map<string, { feeCents: number; detail: string }> {
  const lines: SpecialSuitcaseBaggageAllocationLine[] = [];
  for (const row of rows) {
    const pricing = pricingByOfferingId.get(row.offeringId);
    if (!pricing || row.quantity <= 0) continue;
    lines.push({
      offeringId: row.offeringId,
      quantity: row.quantity,
      addedAt: row.addedAt,
      airlineSecondBagUsdCents: pricing.airlineSecondBagUsdCents,
      airlineThirdBagUsdCents: pricing.airlineThirdBagUsdCents,
    });
  }
  return allocateSpecialFeatureAirlineBaggageFees(lines);
}

export async function countUserContainerCartLineRows(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: userContainerCartLines.id })
    .from(userContainerCartLines)
    .where(eq(userContainerCartLines.clerkUserId, clerkUserId));
  return rows.length;
}

export async function listUserContainerCartWithOfferings(
  clerkUserId: string,
): Promise<UserContainerCartRow[]> {
  const db = getDb();
  const lines = await db
    .select({
      cartLineId: userContainerCartLines.id,
      quantity: userContainerCartLines.quantity,
      addedAt: userContainerCartLines.updatedAt,
      offering: containerOfferings,
    })
    .from(userContainerCartLines)
    .innerJoin(
      containerOfferings,
      eq(userContainerCartLines.containerOfferingId, containerOfferings.id),
    )
    .where(eq(userContainerCartLines.clerkUserId, clerkUserId))
    .orderBy(asc(containerOfferings.sortIndex), desc(containerOfferings.createdAt));

  if (lines.length === 0) return [];

  const offeringIds = lines.map((l) => l.offering.id);
  const imgs =
    offeringIds.length === 0
      ? []
      : await db
          .select()
          .from(containerOfferingImages)
          .where(inArray(containerOfferingImages.containerOfferingId, offeringIds))
          .orderBy(
            containerOfferingImages.containerOfferingId,
            containerOfferingImages.sortIndex,
          );

  const byOffering = new Map<string, ContainerOfferingImage[]>();
  for (const im of imgs) {
    const list = byOffering.get(im.containerOfferingId) ?? [];
    list.push(im);
    byOffering.set(im.containerOfferingId, list);
  }

  return lines.map((l) => ({
    cartLineId: l.cartLineId,
    quantity: l.quantity,
    addedAt: l.addedAt,
    offering: l.offering,
    images: byOffering.get(l.offering.id) ?? [],
  }));
}

/**
 * Active offerings in the user’s cart with positive quantity, for checkout pricing.
 */
export async function listContainerCheckoutLinesForUser(
  clerkUserId: string,
): Promise<ContainerCheckoutLine[]> {
  const rows = await listUserContainerCartWithOfferings(clerkUserId);
  const pricingByOfferingId = await getSpecialFeatureCartPricingByOfferingIds(
    rows.map((r) => r.offering),
  );
  const baggageAllocation = buildSpecialSuitcaseBaggageAllocation(
    rows.map((r) => ({
      offeringId: r.offering.id,
      quantity: r.quantity,
      addedAt: r.addedAt,
    })),
    pricingByOfferingId,
  );
  const out: ContainerCheckoutLine[] = [];
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    if (!r.offering.isActive) continue;
    const unit = r.offering.priceUsdCents;
    const lineTotal = unit * r.quantity;
    const pricing = pricingByOfferingId.get(r.offering.id);
    const transportationFeeUnitCents = pricing?.transportationFeeUnitCents ?? 0;
    const transportationFeeCents = transportationFeeUnitCents * r.quantity;
    const baggage = baggageAllocation.get(r.offering.id);
    const airlineBaggageFeeCents = baggage?.feeCents ?? 0;
    const airlineBaggageFeeDetail = baggage?.detail ?? "";
    const merchandiseCents =
      lineTotal + transportationFeeCents + airlineBaggageFeeCents;
    if (!Number.isFinite(merchandiseCents) || merchandiseCents <= 0) continue;
    out.push({
      offeringId: r.offering.id,
      name: r.offering.name.trim() || "Container",
      sizeLabel: r.offering.sizeLabel.trim() || "—",
      kind: r.offering.kind,
      quantity: r.quantity,
      unitPriceCents: unit,
      lineTotalCents: lineTotal,
      transportationFeeUnitCents,
      transportationFeeCents,
      airlineName: pricing?.airlineName ?? "",
      airlineSecondBagUsdCents: pricing?.airlineSecondBagUsdCents ?? 0,
      airlineThirdBagUsdCents: pricing?.airlineThirdBagUsdCents ?? 0,
      airlineBaggageFeeCents,
      airlineBaggageFeeDetail,
      cartLineAddedAt: pricing ? r.addedAt : null,
    });
  }
  return out;
}

export function sumContainerCheckoutLinesCents(
  lines: ContainerCheckoutLine[],
): number {
  return lines.reduce(
    (s, l) =>
      s + l.lineTotalCents + l.transportationFeeCents + l.airlineBaggageFeeCents,
    0,
  );
}

/** Total barrel / bin quantities in the shopper container cart (by offering kind). */
export function sumContainerCartQuantitiesByKind(
  rows: Pick<UserContainerCartRow, "quantity" | "offering">[],
): { barrelCount: number; binCount: number } {
  return sumContainerQuantitiesByKind(
    rows.map((r) => ({ quantity: r.quantity, kind: r.offering.kind })),
  );
}

/** Sum quantities by container kind (cart rows or checkout lines). */
export function sumContainerQuantitiesByKind(
  rows: { quantity: number; kind: ContainerOfferingKind }[],
): { barrelCount: number; binCount: number } {
  let barrelCount = 0;
  let binCount = 0;
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    if (r.kind === "barrel") barrelCount += r.quantity;
    else if (r.kind === "bin") binCount += r.quantity;
  }
  return { barrelCount, binCount };
}

/**
 * After a pending order is removed, put reserved container rows back on the shopper cart.
 */
export async function mergeRestoredContainerOrderLinesIntoUserCart(
  clerkUserId: string,
  rows: Pick<
    OrderContainerItem,
    "containerOfferingId" | "quantity"
  >[],
): Promise<void> {
  const db = getDb();
  for (const row of rows) {
    if (!row.containerOfferingId || row.quantity <= 0) continue;
    await db
      .insert(userContainerCartLines)
      .values({
        clerkUserId,
        containerOfferingId: row.containerOfferingId,
        quantity: row.quantity,
      })
      .onConflictDoUpdate({
        target: [
          userContainerCartLines.clerkUserId,
          userContainerCartLines.containerOfferingId,
        ],
        set: {
          quantity: sql`${userContainerCartLines.quantity} + excluded.quantity`,
        },
      });
  }
}

export async function clearUserContainerCartLinesForOfferings(
  clerkUserId: string,
  offeringIds: string[],
): Promise<void> {
  if (offeringIds.length === 0) return;
  const db = getDb();
  await db
    .delete(userContainerCartLines)
    .where(
      and(
        eq(userContainerCartLines.clerkUserId, clerkUserId),
        inArray(userContainerCartLines.containerOfferingId, offeringIds),
      ),
    );
}
