import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelItems,
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
} from "@/db/schema";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import type {
  BarrelShippingIntakeContainerRow,
  BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import { isContainerReadyForShippingIntake } from "@/lib/barrel-shipping-intake";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";
import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { ensureBarrelsProvisionedForUser } from "@/data/ensure-paid-order-barrels";
import { isMissingBarrelShippingIntakesTableError } from "@/lib/db-column-missing";

async function loadItemCountsByBarrel(
  barrelIds: string[],
): Promise<Map<string, number>> {
  if (barrelIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const counts = await db
    .select({
      barrelId: barrelItems.barrelId,
      c: sql<number>`count(*)::int`,
    })
    .from(barrelItems)
    .where(inArray(barrelItems.barrelId, barrelIds))
    .groupBy(barrelItems.barrelId);

  return new Map(counts.map((r) => [r.barrelId, r.c] as const));
}

function mapBarrelRows(
  rows: {
    barrel: typeof barrels.$inferSelect;
    oci: typeof orderContainerItems.$inferSelect | null;
    intake: typeof barrelShippingIntakes.$inferSelect | null;
  }[],
  countByBarrel: Map<string, number>,
  chargesByBarrel: Map<string, import("@/lib/barrel-outbound-shipping-charge").BarrelOutboundShippingChargeView>,
  imageByOfferingId: Map<string, string>,
): {
  awaiting: BarrelShippingIntakeContainerRow[];
  submitted: BarrelShippingIntakeSubmittedRow[];
} {
  const aliasMap = buildContainerAliasMap(
    rows.map((r) => ({
      barrelId: r.barrel.id,
      kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
      createdAt: r.barrel.createdAt,
    })),
  );

  const awaiting: BarrelShippingIntakeContainerRow[] = [];
  const submitted: BarrelShippingIntakeSubmittedRow[] = [];

  for (const r of rows) {
    const kind = parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel");
    const alias =
      aliasMap.get(r.barrel.id) ?? (kind === "barrel" ? "Barrel" : "Bin");
    const oci = r.oci;
    const slotLabel =
      oci ?
        formatBarrelSlotLabel({
          nameSnapshot: oci.nameSnapshot,
          sizeSnapshot: oci.sizeSnapshot,
          unitOrdinal: r.barrel.unitOrdinal,
        })
      : `Container ${r.barrel.id.slice(0, 8)}…`;
    const itemCount = countByBarrel.get(r.barrel.id) ?? 0;
    const containerName = oci?.nameSnapshot.trim() || alias;
    const offeringId = oci?.containerOfferingId ?? null;
    const containerImageUrl =
      offeringId ? (imageByOfferingId.get(offeringId) ?? null) : null;

    const base: BarrelShippingIntakeContainerRow = {
      barrelId: r.barrel.id,
      alias,
      slotLabel,
      containerName,
      containerImageUrl,
      kind,
      status: r.barrel.status,
      capacityPercentage: r.barrel.capacityPercentage,
      itemCount,
    };

    if (r.intake) {
      submitted.push({
        ...base,
        intakeId: r.intake.id,
        deliveryMethod: r.intake.deliveryMethod,
        contactPhone: r.intake.contactPhone,
        specialInstructions: r.intake.specialInstructions,
        submittedAt: r.intake.createdAt,
        outboundCharge: chargesByBarrel.get(r.barrel.id) ?? null,
      });
      continue;
    }

    if (isContainerReadyForShippingIntake(base)) {
      awaiting.push(base);
    }
  }

  return { awaiting, submitted };
}

export type BarrelShippingIntakePageData = {
  awaiting: BarrelShippingIntakeContainerRow[];
  submitted: BarrelShippingIntakeSubmittedRow[];
};

async function loadBarrelShippingIntakeRows(
  clerkUserId: string,
): Promise<
  {
    barrel: typeof barrels.$inferSelect;
    oci: typeof orderContainerItems.$inferSelect | null;
    intake: typeof barrelShippingIntakes.$inferSelect | null;
  }[]
> {
  const db = getDb();
  return db
    .select({
      barrel: barrels,
      oci: orderContainerItems,
      intake: barrelShippingIntakes,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .leftJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrels.id),
    )
    .where(eq(barrels.clerkUserId, clerkUserId));
}

export async function getBarrelShippingIntakePageData(
  clerkUserId: string,
): Promise<BarrelShippingIntakePageData> {
  await ensureBarrelsProvisionedForUser(clerkUserId);
  await ensureBarrelShippingIntakesSchema();

  let rows: Awaited<ReturnType<typeof loadBarrelShippingIntakeRows>>;
  try {
    rows = await loadBarrelShippingIntakeRows(clerkUserId);
  } catch (e) {
    if (!isMissingBarrelShippingIntakesTableError(e)) {
      throw e;
    }
    if (!(await ensureBarrelShippingIntakesSchema())) {
      throw e;
    }
    rows = await loadBarrelShippingIntakeRows(clerkUserId);
  }

  const barrelIds = rows.map((r) => r.barrel.id);
  const submittedBarrelIds = rows
    .filter((r) => r.intake != null)
    .map((r) => r.barrel.id);
  const offeringIds = [
    ...new Set(
      rows
        .map((r) => r.oci?.containerOfferingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [countByBarrel, chargesByBarrel, imageByOfferingId] = await Promise.all([
    loadItemCountsByBarrel(barrelIds),
    getOutboundShippingChargesByBarrelIds(clerkUserId, submittedBarrelIds),
    getPrimaryImageUrlByOfferingIds(offeringIds),
  ]);
  return mapBarrelRows(rows, countByBarrel, chargesByBarrel, imageByOfferingId);
}

export async function getBarrelForShippingIntake(
  clerkUserId: string,
  barrelId: string,
): Promise<
  | {
      barrel: typeof barrels.$inferSelect;
      intake: typeof barrelShippingIntakes.$inferSelect | null;
    }
  | undefined
> {
  await ensureBarrelShippingIntakesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      barrel: barrels,
      intake: barrelShippingIntakes,
    })
    .from(barrels)
    .leftJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrels.id),
    )
    .where(and(eq(barrels.id, barrelId), eq(barrels.clerkUserId, clerkUserId))!)
    .limit(1);

  if (!row) {
    return undefined;
  }
  return row;
}
