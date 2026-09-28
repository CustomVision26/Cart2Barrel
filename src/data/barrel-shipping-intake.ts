import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelItems,
  barrelOutboundShippingCharges,
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
import { isContainerVisibleOnShipping } from "@/lib/barrel-shipping-intake";
import { OWN_TRANSPORT_COURIER_KEY } from "@/lib/destination-clearance-partners";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";
import { getBarrelContentsByBarrelIds } from "@/data/barrel-contents";
import {
  ensureOrderContainerPackagingFeeColumns,
  orderContainerItemSnapshotColumns,
  type OrderContainerItemSnapshot,
} from "@/data/ensure-order-container-packaging-fee-schema";
import {
  getOutboundShippingChargesByBarrelIds,
  resetBrokerAndCourierPaymentsForBarrel,
  seedDefaultOutboundChargesForUser,
} from "@/data/barrel-outbound-shipping-charges";
import { getPrimaryImageUrlByOfferingIds } from "@/data/container-offerings";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { ensureBarrelsProvisionedForUser } from "@/data/ensure-paid-order-barrels";
import {
  isMissingBarrelShippingIntakesTableError,
  isMissingOrderContainerPackagingFeeColumnError,
} from "@/lib/db-column-missing";

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
    oci: OrderContainerItemSnapshot | null;
    intake: typeof barrelShippingIntakes.$inferSelect | null;
  }[],
  countByBarrel: Map<string, number>,
  chargesByBarrel: Map<string, import("@/lib/barrel-outbound-shipping-charge").BarrelOutboundShippingChargeView[]>,
  imageByOfferingId: Map<string, string>,
  contentsByBarrel: Map<string, import("@/lib/barrel-contents").BarrelContentItem[]>,
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
    const containerName = oci?.nameSnapshot.trim() || alias;
    const offeringId = oci?.containerOfferingId ?? null;
    const containerImageUrl =
      offeringId ? (imageByOfferingId.get(offeringId) ?? null) : null;
    const itemCount = countByBarrel.get(r.barrel.id) ?? 0;
    const outboundCharges = chargesByBarrel.get(r.barrel.id) ?? [];

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
      contents: contentsByBarrel.get(r.barrel.id) ?? [],
      outboundCharges,
    };

    if (r.intake) {
      submitted.push({
        ...base,
        intakeId: r.intake.id,
        deliveryMethod: r.intake.deliveryMethod,
        selectedBrokerKey: r.intake.selectedBrokerKey,
        selectedCourierKey: r.intake.selectedCourierKey,
        contactPhone: r.intake.contactPhone,
        specialInstructions: r.intake.specialInstructions,
        submittedAt: r.intake.createdAt,
      });
      continue;
    }

    if (isContainerVisibleOnShipping(base)) {
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
    oci: OrderContainerItemSnapshot | null;
    intake: typeof barrelShippingIntakes.$inferSelect | null;
  }[]
> {
  const db = getDb();
  return db
    .select({
      barrel: barrels,
      oci: orderContainerItemSnapshotColumns,
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
  try {
    return await loadBarrelShippingIntakePageData(clerkUserId);
  } catch (e) {
    console.error("[getBarrelShippingIntakePageData]", e);
    return { awaiting: [], submitted: [] };
  }
}

async function loadBarrelShippingIntakePageData(
  clerkUserId: string,
): Promise<BarrelShippingIntakePageData> {
  await ensureBarrelsProvisionedForUser(clerkUserId);
  await ensureBarrelShippingIntakesSchema();
  await ensureOrderContainerPackagingFeeColumns();
  try {
    await seedDefaultOutboundChargesForUser(clerkUserId);
  } catch (e) {
    console.error("[getBarrelShippingIntakePageData] seed default freight", e);
  }

  let rows: Awaited<ReturnType<typeof loadBarrelShippingIntakeRows>>;
  try {
    rows = await loadBarrelShippingIntakeRows(clerkUserId);
  } catch (e) {
    if (
      !isMissingBarrelShippingIntakesTableError(e) &&
      !isMissingOrderContainerPackagingFeeColumnError(e)
    ) {
      throw e;
    }
    if (isMissingOrderContainerPackagingFeeColumnError(e)) {
      await ensureOrderContainerPackagingFeeColumns();
    }
    if (
      isMissingBarrelShippingIntakesTableError(e) &&
      !(await ensureBarrelShippingIntakesSchema())
    ) {
      throw e;
    }
    rows = await loadBarrelShippingIntakeRows(clerkUserId);
  }

  const barrelIds = rows.map((r) => r.barrel.id);
  const offeringIds = [
    ...new Set(
      rows
        .map((r) => r.oci?.containerOfferingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [countByBarrel, chargesByBarrel, imageByOfferingId, contentsByBarrel] =
    await Promise.all([
      loadItemCountsByBarrel(barrelIds).catch((e) => {
        console.error("[getBarrelShippingIntakePageData] item counts", e);
        return new Map<string, number>();
      }),
      getOutboundShippingChargesByBarrelIds(clerkUserId, barrelIds),
      getPrimaryImageUrlByOfferingIds(offeringIds).catch((e) => {
        console.error("[getBarrelShippingIntakePageData] offering images", e);
        return new Map<string, string>();
      }),
      getBarrelContentsByBarrelIds(clerkUserId, barrelIds).catch((e) => {
        console.error("[getBarrelShippingIntakePageData] contents", e);
        return new Map<string, import("@/lib/barrel-contents").BarrelContentItem[]>();
      }),
    ]);
  return mapBarrelRows(
    rows,
    countByBarrel,
    chargesByBarrel,
    imageByOfferingId,
    contentsByBarrel,
  );
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

export async function switchShippingIntakeToSelfClearance(
  clerkUserId: string,
  intakeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelShippingIntakesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      intake: barrelShippingIntakes,
      barrel: barrels,
    })
    .from(barrelShippingIntakes)
    .innerJoin(barrels, eq(barrelShippingIntakes.barrelId, barrels.id))
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
        eq(barrels.clerkUserId, clerkUserId),
      )!,
    )
    .limit(1);

  if (!row) {
    return { ok: false, message: "Submitted preferences not found." };
  }
  if (row.barrel.status === "shipped" || row.barrel.status === "delivered") {
    return {
      ok: false,
      message: "This container has already shipped. Clearance cannot be changed.",
    };
  }
  if (row.intake.deliveryMethod === "customs_pickup") {
    return { ok: true };
  }

  await ensureBarrelOutboundShippingChargesSchema();
  const [brokerCharge] = await db
    .select({
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.barrelId, row.intake.barrelId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, "broker"),
      ),
    )
    .limit(1);
  if (brokerCharge?.paidAt) {
    return {
      ok: false,
      message: "The broker charge is already paid, so this selection cannot change.",
    };
  }

  await db
    .update(barrelShippingIntakes)
    .set({
      deliveryMethod: "customs_pickup",
      selectedBrokerKey: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
      )!,
    );

  return { ok: true };
}

export async function switchShippingIntakeToOwnTransport(
  clerkUserId: string,
  intakeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelShippingIntakesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      intake: barrelShippingIntakes,
      barrel: barrels,
    })
    .from(barrelShippingIntakes)
    .innerJoin(barrels, eq(barrelShippingIntakes.barrelId, barrels.id))
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
        eq(barrels.clerkUserId, clerkUserId),
      )!,
    )
    .limit(1);

  if (!row) {
    return { ok: false, message: "Submitted preferences not found." };
  }
  if (row.barrel.status === "shipped" || row.barrel.status === "delivered") {
    return {
      ok: false,
      message:
        "This container has already shipped. Transportation cannot be changed.",
    };
  }
  const currentKey = row.intake.selectedCourierKey?.trim() || "";
  if (
    currentKey === OWN_TRANSPORT_COURIER_KEY ||
    currentKey === "self-arrange-local"
  ) {
    return { ok: true };
  }

  await ensureBarrelOutboundShippingChargesSchema();
  const [courierCharge] = await db
    .select({
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.barrelId, row.intake.barrelId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, "courier"),
      ),
    )
    .limit(1);
  if (courierCharge?.paidAt) {
    return {
      ok: false,
      message:
        "The local courier charge is already paid, so this selection cannot change.",
    };
  }

  await db
    .update(barrelShippingIntakes)
    .set({
      selectedCourierKey: OWN_TRANSPORT_COURIER_KEY,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
      )!,
    );

  return { ok: true };
}

export async function cancelShippingIntakeForUser(
  clerkUserId: string,
  intakeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelShippingIntakesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      intake: barrelShippingIntakes,
      barrel: barrels,
    })
    .from(barrelShippingIntakes)
    .innerJoin(barrels, eq(barrelShippingIntakes.barrelId, barrels.id))
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
        eq(barrels.clerkUserId, clerkUserId),
      )!,
    )
    .limit(1);

  if (!row) {
    return { ok: false, message: "Submitted preferences not found." };
  }

  if (row.barrel.status === "shipped" || row.barrel.status === "delivered") {
    return {
      ok: false,
      message: "This container has already shipped and cannot be cancelled.",
    };
  }

  await resetBrokerAndCourierPaymentsForBarrel(
    clerkUserId,
    row.intake.barrelId,
  );

  await db
    .delete(barrelShippingIntakes)
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
      )!,
    );

  return { ok: true };
}

export async function updateShippingIntakeRow(
  clerkUserId: string,
  input: {
    intakeId: string;
    deliveryMethod: "customs_pickup" | "broker_delivery";
    selectedBrokerKey: string | null;
    selectedCourierKey: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelShippingIntakesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      intake: barrelShippingIntakes,
      barrel: barrels,
    })
    .from(barrelShippingIntakes)
    .innerJoin(barrels, eq(barrelShippingIntakes.barrelId, barrels.id))
    .where(
      and(
        eq(barrelShippingIntakes.id, input.intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
        eq(barrels.clerkUserId, clerkUserId),
      )!,
    )
    .limit(1);

  if (!row) {
    return { ok: false, message: "Submitted preferences not found." };
  }
  if (row.barrel.status === "shipped" || row.barrel.status === "delivered") {
    return {
      ok: false,
      message: "This container has already shipped. Clearance cannot be changed.",
    };
  }

  await db
    .update(barrelShippingIntakes)
    .set({
      deliveryMethod: input.deliveryMethod,
      selectedBrokerKey: input.selectedBrokerKey,
      selectedCourierKey: input.selectedCourierKey,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(barrelShippingIntakes.id, input.intakeId),
        eq(barrelShippingIntakes.clerkUserId, clerkUserId),
      )!,
    );

  return { ok: true };
}
