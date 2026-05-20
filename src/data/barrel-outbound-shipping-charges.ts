import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { StripeCheckoutPriceDataLine } from "@/data/cart";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrelShippingIntakes,
  barrels,
  orderContainerItems,
  userOutboundShippingCartLines,
} from "@/db/schema";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import { generateOutboundShippingPaymentReference } from "@/lib/generate-outbound-shipping-payment-reference";
import { upsertShipmentTrackingOnFreightPaid } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import type {
  BarrelOutboundShippingChargeView,
  OutboundShippingChargeLineView,
} from "@/lib/barrel-outbound-shipping-charge";
import { sumChargeLineCents } from "@/lib/barrel-outbound-shipping-charge";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { buildContainerAliasMap } from "@/lib/container-slot-alias";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export type OutboundShippingCartLineView = {
  chargeId: string;
  barrelId: string;
  alias: string;
  slotLabel: string;
  kind: ContainerOfferingKind;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  adminNote: string | null;
};

async function loadChargeViewsForBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView>> {
  if (barrelIds.length === 0) {
    return new Map();
  }

  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();

  const charges = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
      ),
    );

  if (charges.length === 0) {
    return new Map();
  }

  const chargeIds = charges.map((c) => c.id);
  const lineRows = await db
    .select()
    .from(barrelOutboundShippingChargeLines)
    .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));

  const linesByCharge = new Map<string, OutboundShippingChargeLineView[]>();
  for (const line of lineRows) {
    const list = linesByCharge.get(line.chargeId) ?? [];
    list.push({ label: line.label, amountCents: line.amountCents });
    linesByCharge.set(line.chargeId, list);
  }

  const cartRows = await db
    .select({ chargeId: userOutboundShippingCartLines.chargeId })
    .from(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
        inArray(userOutboundShippingCartLines.chargeId, chargeIds),
      ),
    );
  const inCartIds = new Set(cartRows.map((r) => r.chargeId));
  const trackingByBarrel = await getShipmentTrackingByBarrelIds(
    charges.map((c) => c.barrelId),
  );

  const byBarrel = new Map<string, BarrelOutboundShippingChargeView>();
  for (const charge of charges) {
    const lines = linesByCharge.get(charge.id) ?? [];
    byBarrel.set(charge.barrelId, {
      chargeId: charge.id,
      lines,
      totalCents: sumChargeLineCents(lines),
      adminNote: charge.adminNote,
      inCart: inCartIds.has(charge.id),
      paidAt: charge.paidAt,
      paymentReferenceNumber: charge.paymentReferenceNumber,
      shipmentTracking: trackingByBarrel.get(charge.barrelId) ?? null,
    });
  }
  return byBarrel;
}

export async function getOutboundShippingChargesByBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView>> {
  await ensureBarrelShippingIntakesSchema();
  try {
    return await loadChargeViewsForBarrelIds(clerkUserId, barrelIds);
  } catch (e) {
    if (!isMissingBarrelOutboundShippingChargesTableError(e)) {
      throw e;
    }
    if (!(await ensureBarrelOutboundShippingChargesSchema())) {
      throw e;
    }
    return await loadChargeViewsForBarrelIds(clerkUserId, barrelIds);
  }
}

export async function listUserOutboundShippingCartLines(
  clerkUserId: string,
): Promise<OutboundShippingCartLineView[]> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const cartRows = await db
    .select({
      charge: barrelOutboundShippingCharges,
      barrel: barrels,
      oci: orderContainerItems,
    })
    .from(userOutboundShippingCartLines)
    .innerJoin(
      barrelOutboundShippingCharges,
      eq(userOutboundShippingCartLines.chargeId, barrelOutboundShippingCharges.id),
    )
    .innerJoin(barrels, eq(barrelOutboundShippingCharges.barrelId, barrels.id))
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
      ),
    );

  if (cartRows.length === 0) {
    return [];
  }

  const chargeIds = cartRows.map((r) => r.charge.id);
  const lineRows = await db
    .select()
    .from(barrelOutboundShippingChargeLines)
    .where(inArray(barrelOutboundShippingChargeLines.chargeId, chargeIds))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));

  const linesByCharge = new Map<string, OutboundShippingChargeLineView[]>();
  for (const line of lineRows) {
    const list = linesByCharge.get(line.chargeId) ?? [];
    list.push({ label: line.label, amountCents: line.amountCents });
    linesByCharge.set(line.chargeId, list);
  }

  const aliasMap = buildContainerAliasMap(
    cartRows.map((r) => ({
      barrelId: r.barrel.id,
      kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
      createdAt: r.barrel.createdAt,
    })),
  );

  return cartRows.map((r) => {
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
    const lines = linesByCharge.get(r.charge.id) ?? [];

    return {
      chargeId: r.charge.id,
      barrelId: r.barrel.id,
      alias,
      slotLabel,
      kind,
      lines,
      totalCents: sumChargeLineCents(lines),
      adminNote: r.charge.adminNote,
    };
  });
}

export function sumOutboundShippingCartLinesCents(
  lines: OutboundShippingCartLineView[],
): number {
  return lines.reduce((s, l) => s + l.totalCents, 0);
}

export function buildStripeLineItemsFromOutboundShippingCart(
  lines: OutboundShippingCartLineView[],
): StripeCheckoutPriceDataLine[] {
  return lines.map((line) => ({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: line.totalCents,
      product_data: {
        name: `Outbound shipping — ${line.alias}`,
        description: `${line.slotLabel} · ${line.lines.map((l) => l.label).join(", ")}`,
      },
    },
  }));
}

export async function clearOutboundShippingCartForCharges(
  clerkUserId: string,
  chargeIds: string[],
): Promise<void> {
  if (chargeIds.length === 0) return;
  const db = getDb();
  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
        inArray(userOutboundShippingCartLines.chargeId, chargeIds),
      ),
    );
}

export async function markOutboundShippingChargesPaid(
  clerkUserId: string,
  chargeIds: string[],
  payment: { orderId: string; stripePaymentIntentId: string },
): Promise<void> {
  if (chargeIds.length === 0) return;
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureBarrelOutboundShipmentTrackingSchema();
  const db = getDb();
  const now = new Date().toISOString();

  const charges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.id, chargeIds),
      ),
    );

  for (const charge of charges) {
    if (charge.paidAt) {
      continue;
    }
    const paymentReferenceNumber = await generateOutboundShippingPaymentReference();
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        paidAt: now,
        updatedAt: now,
        paymentReferenceNumber,
        paidOrderId: payment.orderId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      })
      .where(eq(barrelOutboundShippingCharges.id, charge.id));

    await upsertShipmentTrackingOnFreightPaid({
      barrelId: charge.barrelId,
      chargeId: charge.id,
    });
  }
}

export async function getOutboundShippingChargeForUser(
  clerkUserId: string,
  chargeId: string,
): Promise<
  | {
      charge: typeof barrelOutboundShippingCharges.$inferSelect;
      intake: typeof barrelShippingIntakes.$inferSelect;
    }
  | undefined
> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      charge: barrelOutboundShippingCharges,
      intake: barrelShippingIntakes,
    })
    .from(barrelOutboundShippingCharges)
    .innerJoin(
      barrelShippingIntakes,
      eq(barrelShippingIntakes.barrelId, barrelOutboundShippingCharges.barrelId),
    )
    .where(
      and(
        eq(barrelOutboundShippingCharges.id, chargeId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);

  return row;
}
