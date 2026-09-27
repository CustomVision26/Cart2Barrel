import "server-only";

import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import type { StripeCheckoutPriceDataLine } from "@/data/cart";
import { STRIPE_CHECKOUT_LINE_MIN_US_CENTS } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrels,
  orderContainerItems,
  userOutboundShippingCartLines,
} from "@/db/schema";
import {
  addOutboundShippingPartner,
  getPrimaryOutboundShippingPartner,
} from "@/data/barrel-outbound-shipping-partners";
import { getShipmentTrackingByBarrelIds } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { ensureBarrelOutboundShipmentTrackingSchema } from "@/data/ensure-barrel-outbound-shipment-tracking-schema";
import { generateOutboundShippingPaymentReference } from "@/lib/generate-outbound-shipping-payment-reference";
import { upsertShipmentTrackingOnFreightPaid } from "@/data/barrel-outbound-shipment-tracking";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import type {
  BarrelOutboundShippingChargeView,
  OffPlatformPaymentMethod,
  OutboundShippingChargeLineView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  isBarrelOutboundShippingChargeKind,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentMethod,
  isOutboundChargeKindAbsorbed,
  outboundChargeBundleHost,
  parseOutboundChargeBundle,
  serializeOutboundChargeBundle,
  sumChargeLineCents,
  type BarrelOutboundShippingChargeKind,
} from "@/lib/barrel-outbound-shipping-charge";
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
  chargeKind: import("@/lib/barrel-outbound-shipping-charge").BarrelOutboundShippingChargeKind;
  partnerName: string | null;
  partnerAddress: string | null;
  partnerCountry: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  adminNote: string | null;
};

async function loadChargeViewsForBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView[]>> {
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
  const bundleRows = await db
    .select({
      id: barrels.id,
      outboundChargeBundle: barrels.outboundChargeBundle,
    })
    .from(barrels)
    .where(inArray(barrels.id, barrelIds));
  const bundleByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseOutboundChargeBundle(row.outboundChargeBundle),
    ]),
  );

  const byBarrel = new Map<string, BarrelOutboundShippingChargeView[]>();
  for (const charge of charges) {
    const lines = linesByCharge.get(charge.id) ?? [];
    const list = byBarrel.get(charge.barrelId) ?? [];
    list.push({
      chargeId: charge.id,
      chargeKind: isBarrelOutboundShippingChargeKind(charge.chargeKind)
        ? charge.chargeKind
        : "freight",
      partnerName: charge.partnerName,
      partnerLocation: charge.partnerLocation,
      partnerAddress: charge.partnerAddress,
      partnerCountry: charge.partnerCountry,
      partnerPhone: charge.partnerPhone,
      partnerCashappId: charge.partnerCashappId,
      partnerCashappAccount: charge.partnerCashappAccount,
      partnerZelleId: charge.partnerZelleId,
      partnerZelleAccount: charge.partnerZelleAccount,
      lines,
      totalCents: sumChargeLineCents(lines),
      adminNote: charge.adminNote,
      inCart:
        isBarrelOutboundShippingChargeKind(charge.chargeKind) &&
        charge.chargeKind === "freight" &&
        inCartIds.has(charge.id),
      paidAt: charge.paidAt,
      paymentReferenceNumber: charge.paymentReferenceNumber,
      paidOrderId: charge.paidOrderId,
      offPlatformPaymentMethod: isOffPlatformPaymentMethod(
        charge.offPlatformPaymentMethod,
      )
        ? charge.offPlatformPaymentMethod
        : null,
      offPlatformPayerName: charge.offPlatformPayerName,
      offPlatformReceiptUrl: charge.offPlatformReceiptUrl,
      offPlatformSubmittedAt: charge.offPlatformSubmittedAt,
      shipmentTracking: trackingByBarrel.get(charge.barrelId) ?? null,
      updatedByClerkUserId: charge.recordedByClerkUserId,
      chargeBundle: bundleByBarrel.get(charge.barrelId) ?? [],
    });
    byBarrel.set(charge.barrelId, list);
  }
  return byBarrel;
}

export async function getOutboundShippingChargesByBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelOutboundShippingChargeView[]>> {
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

  const barrelIds = [...new Set(cartRows.map((r) => r.barrel.id))];
  const siblingCharges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
      ),
    );
  const chargeIds = [...new Set(siblingCharges.map((row) => row.id))];
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
  const siblingsByBarrel = new Map<string, typeof siblingCharges>();
  for (const sibling of siblingCharges) {
    const list = siblingsByBarrel.get(sibling.barrelId) ?? [];
    list.push(sibling);
    siblingsByBarrel.set(sibling.barrelId, list);
  }

  const aliasMap = buildContainerAliasMap(
    cartRows.map((r) => ({
      barrelId: r.barrel.id,
      kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
      createdAt: r.barrel.createdAt,
    })),
  );

  return cartRows
    .filter(
      (r) =>
        isBarrelOutboundShippingChargeKind(r.charge.chargeKind) &&
        r.charge.chargeKind === "freight",
    )
    .map((r) => {
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
    const bundle = parseOutboundChargeBundle(r.barrel.outboundChargeBundle);
    const extraLines = (siblingsByBarrel.get(r.barrel.id) ?? [])
      .filter(
        (other) =>
          isBarrelOutboundShippingChargeKind(other.chargeKind) &&
          isOutboundChargeKindAbsorbed(other.chargeKind, bundle),
      )
      .flatMap((other) => linesByCharge.get(other.id) ?? []);
    const mergedLines = [...lines, ...extraLines];

    return {
      chargeId: r.charge.id,
      barrelId: r.barrel.id,
      alias,
      slotLabel,
      kind,
      chargeKind: isBarrelOutboundShippingChargeKind(r.charge.chargeKind)
        ? r.charge.chargeKind
        : "freight",
      partnerName: r.charge.partnerName,
      partnerAddress: r.charge.partnerAddress,
      partnerCountry: r.charge.partnerCountry,
      lines: mergedLines,
      totalCents: sumChargeLineCents(mergedLines),
      adminNote: r.charge.adminNote,
    };
  });
}

export function sumOutboundShippingCartLinesCents(
  lines: OutboundShippingCartLineView[],
): number {
  return lines.reduce((s, l) => s + l.totalCents, 0);
}

/** Lightweight count of outbound shipping charges in the user's cart (header badge). */
export async function countUserOutboundShippingCartLineRows(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  try {
    const rows = await db
      .select({ chargeKind: barrelOutboundShippingCharges.chargeKind })
      .from(userOutboundShippingCartLines)
      .innerJoin(
        barrelOutboundShippingCharges,
        eq(
          userOutboundShippingCartLines.chargeId,
          barrelOutboundShippingCharges.id,
        ),
      )
      .where(
        and(
          eq(userOutboundShippingCartLines.clerkUserId, clerkUserId),
          eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        ),
      );
    return rows.filter((row) => row.chargeKind === "freight").length;
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return 0;
    }
    throw e;
  }
}

/**
 * Stripe Checkout line items for outbound container shipping. Each itemized
 * charge (freight, customs, pickup, etc.) becomes its own checkout line so the
 * customer clearly sees what they are paying for. If a container has any line
 * below Stripe's per-line minimum, that container falls back to a single
 * combined line whose description still spells out every charge and amount.
 */
export function buildStripeLineItemsFromOutboundShippingCart(
  lines: OutboundShippingCartLineView[],
): StripeCheckoutPriceDataLine[] {
  const items: StripeCheckoutPriceDataLine[] = [];

  for (const line of lines) {
    const chargeLines = line.lines.filter((l) => l.amountCents > 0);

    if (chargeLines.length === 0) {
      items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: line.totalCents,
          product_data: {
            name: `Outbound shipping — ${line.alias}`,
            description: line.slotLabel,
          },
        },
      });
      continue;
    }

    const canItemize = chargeLines.every(
      (l) => l.amountCents >= STRIPE_CHECKOUT_LINE_MIN_US_CENTS,
    );

    if (canItemize) {
      for (const charge of chargeLines) {
        items.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: charge.amountCents,
            product_data: {
              name: `Shipping: ${charge.label}`,
              description: `${line.alias} · ${line.slotLabel}${
                line.partnerName ? ` · ${line.partnerName}` : ""
              }`,
            },
          },
        });
      }
      continue;
    }

    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: line.totalCents,
        product_data: {
          name: `Outbound shipping — ${line.alias}`,
          description: `${line.slotLabel} · ${chargeLines
            .map((l) => `${l.label} ${formatUsd(l.amountCents)}`)
            .join(", ")}`,
        },
      },
    });
  }

  return items;
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

/**
 * Re-adds outbound shipping charges to the user's cart after an abandoned/cancelled
 * checkout (charges are cleared from the cart when a Stripe session is created).
 * Only restores charges the user owns that are still unpaid; existing rows are kept.
 */
export async function restoreOutboundShippingCartForCharges(
  clerkUserId: string,
  chargeIds: string[],
): Promise<void> {
  if (chargeIds.length === 0) return;
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const restorable = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.id, chargeIds),
        isNull(barrelOutboundShippingCharges.paidAt),
      ),
    );
  const freightOnly = restorable.filter((c) => c.chargeKind === "freight");
  if (freightOnly.length === 0) return;

  await db
    .insert(userOutboundShippingCartLines)
    .values(freightOnly.map((c) => ({ clerkUserId, chargeId: c.id })))
    .onConflictDoNothing();
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
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        inArray(barrelOutboundShippingCharges.id, chargeIds),
      ),
    );

  const paidBarrelIds = [...new Set(charges.map((charge) => charge.barrelId))];
  const bundleRows =
    paidBarrelIds.length > 0
      ? await db
          .select({
            id: barrels.id,
            outboundChargeBundle: barrels.outboundChargeBundle,
          })
          .from(barrels)
          .where(inArray(barrels.id, paidBarrelIds))
      : [];
  const bundleByBarrel = new Map(
    bundleRows.map((row) => [
      row.id,
      parseOutboundChargeBundle(row.outboundChargeBundle),
    ]),
  );

  const absorbed =
    paidBarrelIds.length > 0
      ? await db
          .select({
            id: barrelOutboundShippingCharges.id,
            barrelId: barrelOutboundShippingCharges.barrelId,
            chargeKind: barrelOutboundShippingCharges.chargeKind,
            paidAt: barrelOutboundShippingCharges.paidAt,
          })
          .from(barrelOutboundShippingCharges)
          .where(
            and(
              eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
              inArray(barrelOutboundShippingCharges.barrelId, paidBarrelIds),
            ),
          )
      : [];

  const toPay = new Map(charges.map((charge) => [charge.id, charge]));
  for (const sibling of absorbed) {
    if (sibling.paidAt || toPay.has(sibling.id)) continue;
    if (!isBarrelOutboundShippingChargeKind(sibling.chargeKind)) continue;
    const bundle = bundleByBarrel.get(sibling.barrelId) ?? [];
    if (!isOutboundChargeKindAbsorbed(sibling.chargeKind, bundle)) continue;
    const hostPaid = charges.some(
      (charge) =>
        charge.barrelId === sibling.barrelId &&
        isBarrelOutboundShippingChargeKind(charge.chargeKind) &&
        charge.chargeKind === outboundChargeBundleHost(bundle),
    );
    if (hostPaid) {
      toPay.set(sibling.id, sibling);
    }
  }

  for (const charge of toPay.values()) {
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
    }
  | undefined
> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select({
      charge: barrelOutboundShippingCharges,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.id, chargeId),
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);

  return row;
}

export async function recordOutboundOffPlatformPayment(input: {
  clerkUserId: string;
  chargeId: string;
  paymentMethod: OffPlatformPaymentMethod;
  payerAccountName: string | null;
  receiptUrl: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [charge] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.id, input.chargeId),
        eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
      ),
    )
    .limit(1);
  if (!charge) {
    return { ok: false, message: "Shipping charge not found." };
  }
  if (!isBarrelOutboundShippingChargeKind(charge.chargeKind) ||
      !isOffPlatformOutboundChargeKind(charge.chargeKind)) {
    return {
      ok: false,
      message: "This charge is paid through the cart, not Zelle or Cash App.",
    };
  }
  if (charge.paidAt) {
    return { ok: false, message: "This charge is already marked paid." };
  }
  const replacingLocalOffice =
    Boolean(charge.offPlatformSubmittedAt) &&
    charge.offPlatformPaymentMethod === "local_office" &&
    (input.paymentMethod === "zelle" || input.paymentMethod === "cashapp");
  if (charge.offPlatformSubmittedAt && !replacingLocalOffice) {
    return { ok: false, message: "This charge already has a payment on file." };
  }

  const now = new Date().toISOString();

  await db
    .update(barrelOutboundShippingCharges)
    .set({
      offPlatformPaymentMethod: input.paymentMethod,
      offPlatformPayerName: input.payerAccountName,
      offPlatformReceiptUrl: input.receiptUrl,
      offPlatformSubmittedAt: now,
      updatedAt: now,
    })
    .where(eq(barrelOutboundShippingCharges.id, charge.id));

  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, input.clerkUserId),
        eq(userOutboundShippingCartLines.chargeId, charge.id),
      ),
    );

  return { ok: true };
}

export async function approveOutboundOffPlatformPayment(
  chargeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [charge] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.id, chargeId))
    .limit(1);
  if (!charge) {
    return { ok: false, message: "Shipping charge not found." };
  }
  if (
    !isBarrelOutboundShippingChargeKind(charge.chargeKind) ||
    !isOffPlatformOutboundChargeKind(charge.chargeKind)
  ) {
    return { ok: false, message: "This charge is not a broker or courier payment." };
  }
  if (charge.paidAt) {
    return { ok: false, message: "This charge is already approved as paid." };
  }
  if (!charge.offPlatformSubmittedAt) {
    return {
      ok: false,
      message: "The customer has not submitted a payment for this charge yet.",
    };
  }

  const now = new Date().toISOString();
  const paymentReferenceNumber = await generateOutboundShippingPaymentReference();
  await db
    .update(barrelOutboundShippingCharges)
    .set({
      paidAt: now,
      paymentReferenceNumber,
      updatedAt: now,
    })
    .where(eq(barrelOutboundShippingCharges.id, charge.id));

  return { ok: true };
}

/**
 * Copies the latest published freight quote (Tropical Shipping, line amounts)
 * onto active barrels that do not have a freight charge yet.
 */
export async function seedDefaultOutboundChargesForUser(
  clerkUserId: string,
): Promise<void> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const activeBarrels = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(
      and(
        eq(barrels.clerkUserId, clerkUserId),
        notInArray(barrels.status, ["shipped", "delivered"]),
      ),
    );
  if (activeBarrels.length === 0) {
    return;
  }

  const barrelIds = activeBarrels.map((row) => row.id);
  const existingFreight = await db
    .select({ barrelId: barrelOutboundShippingCharges.barrelId })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
        eq(barrelOutboundShippingCharges.chargeKind, "freight"),
      ),
    );
  const alreadyHasFreight = new Set(existingFreight.map((row) => row.barrelId));
  const missing = activeBarrels.filter((row) => !alreadyHasFreight.has(row.id));
  if (missing.length === 0) {
    return;
  }

  const template = await findDefaultFreightChargeTemplate(clerkUserId);
  if (!template) {
    return;
  }

  for (const barrel of missing) {
    try {
      await copyFreightChargeTemplateToBarrel({
        destBarrelId: barrel.id,
        destClerkUserId: clerkUserId,
        template,
      });
    } catch (e) {
      console.error(
        "[seedDefaultOutboundChargesForUser] copy freight",
        barrel.id,
        e,
      );
    }
  }
}

type FreightChargeTemplate = {
  charge: typeof barrelOutboundShippingCharges.$inferSelect;
  lines: { label: string; amountCents: number; sortIndex: number }[];
};

async function freightTemplateFromCharges(
  charges: (typeof barrelOutboundShippingCharges.$inferSelect)[],
): Promise<FreightChargeTemplate | null> {
  const db = getDb();
  for (const charge of charges) {
    const lineRows = await db
      .select({
        label: barrelOutboundShippingChargeLines.label,
        amountCents: barrelOutboundShippingChargeLines.amountCents,
        sortIndex: barrelOutboundShippingChargeLines.sortIndex,
      })
      .from(barrelOutboundShippingChargeLines)
      .where(eq(barrelOutboundShippingChargeLines.chargeId, charge.id))
      .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));
    const lines = lineRows.filter((line) => line.amountCents > 0);
    if (lines.length > 0) {
      return { charge, lines };
    }
  }
  return null;
}

async function findDefaultFreightChargeTemplate(
  preferClerkUserId: string,
): Promise<FreightChargeTemplate | null> {
  const db = getDb();
  const own = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, preferClerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, "freight"),
      ),
    )
    .orderBy(desc(barrelOutboundShippingCharges.updatedAt))
    .limit(8);
  const fromOwn = await freightTemplateFromCharges(own);
  if (fromOwn) {
    return fromOwn;
  }

  const any = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(eq(barrelOutboundShippingCharges.chargeKind, "freight"))
    .orderBy(desc(barrelOutboundShippingCharges.updatedAt))
    .limit(12);
  return freightTemplateFromCharges(any);
}

async function copyFreightChargeTemplateToBarrel(input: {
  destBarrelId: string;
  destClerkUserId: string;
  template: FreightChargeTemplate;
}): Promise<void> {
  const db = getDb();
  const source = input.template.charge;
  const partner =
    (await getPrimaryOutboundShippingPartner(source.barrelId, "freight")) ?? null;

  const [inserted] = await db
    .insert(barrelOutboundShippingCharges)
    .values({
      barrelId: input.destBarrelId,
      clerkUserId: input.destClerkUserId,
      chargeKind: "freight",
      partnerName: partner?.name ?? source.partnerName,
      partnerLocation: null,
      partnerAddress: partner?.address ?? source.partnerAddress,
      partnerCountry: null,
      partnerPhone: partner?.phone ?? source.partnerPhone,
      partnerCashappId: partner?.cashappId ?? source.partnerCashappId,
      partnerCashappAccount:
        partner?.cashappAccount ?? source.partnerCashappAccount,
      partnerZelleId: partner?.zelleId ?? source.partnerZelleId,
      partnerZelleAccount: partner?.zelleAccount ?? source.partnerZelleAccount,
      adminNote: source.adminNote,
      recordedByClerkUserId: source.recordedByClerkUserId,
    })
    .onConflictDoNothing({
      target: [
        barrelOutboundShippingCharges.barrelId,
        barrelOutboundShippingCharges.chargeKind,
      ],
    })
    .returning({ id: barrelOutboundShippingCharges.id });

  const chargeId = inserted?.id;
  if (!chargeId) {
    return;
  }

  await db.insert(barrelOutboundShippingChargeLines).values(
    input.template.lines.map((line) => ({
      chargeId,
      label: line.label,
      amountCents: line.amountCents,
      sortIndex: line.sortIndex,
    })),
  );

  const partnerName = (partner?.name ?? source.partnerName)?.trim();
  if (!partnerName) {
    return;
  }

  await addOutboundShippingPartner({
    barrelId: input.destBarrelId,
    chargeKind: "freight",
    name: partnerName,
    location: null,
    address: partner?.address ?? source.partnerAddress,
    country: null,
    phone: partner?.phone ?? source.partnerPhone,
    cashappId: partner?.cashappId ?? source.partnerCashappId,
    cashappAccount: partner?.cashappAccount ?? source.partnerCashappAccount,
    zelleId: partner?.zelleId ?? source.partnerZelleId,
    zelleAccount: partner?.zelleAccount ?? source.partnerZelleAccount,
    isPrimary: true,
  });
}

export async function setOutboundChargeBundleForBarrel(input: {
  barrelId: string;
  kinds: BarrelOutboundShippingChargeKind[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [barrel] = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
    })
    .from(barrels)
    .where(eq(barrels.id, input.barrelId))
    .limit(1);
  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  const serialized = serializeOutboundChargeBundle(input.kinds);
  await db
    .update(barrels)
    .set({ outboundChargeBundle: serialized })
    .where(eq(barrels.id, input.barrelId));
  return { ok: true };
}

/** Clears broker/courier payment so the customer can submit receipts again. Freight stays paid. */
export async function resetBrokerAndCourierPaymentsForBarrel(
  clerkUserId: string,
  barrelId: string,
): Promise<void> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  await db
    .update(barrelOutboundShippingCharges)
    .set({
      offPlatformPaymentMethod: null,
      offPlatformPayerName: null,
      offPlatformReceiptUrl: null,
      offPlatformSubmittedAt: null,
      paidAt: null,
      paymentReferenceNumber: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.barrelId, barrelId),
        inArray(barrelOutboundShippingCharges.chargeKind, ["broker", "courier"]),
      ),
    );
}
