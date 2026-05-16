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

export type ContainerCheckoutLine = {
  offeringId: string;
  name: string;
  sizeLabel: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type UserContainerCartRow = {
  cartLineId: string;
  quantity: number;
  offering: ContainerOffering;
  images: ContainerOfferingImage[];
};

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
  const out: ContainerCheckoutLine[] = [];
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    if (!r.offering.isActive) continue;
    const unit = r.offering.priceUsdCents;
    const lineTotal = unit * r.quantity;
    if (!Number.isFinite(lineTotal) || lineTotal <= 0) continue;
    out.push({
      offeringId: r.offering.id,
      name: r.offering.name.trim() || "Container",
      sizeLabel: r.offering.sizeLabel.trim() || "—",
      quantity: r.quantity,
      unitPriceCents: unit,
      lineTotalCents: lineTotal,
    });
  }
  return out;
}

export function sumContainerCheckoutLinesCents(
  lines: ContainerCheckoutLine[],
): number {
  return lines.reduce((s, l) => s + l.lineTotalCents, 0);
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
          updatedAt: sql`now()`,
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
