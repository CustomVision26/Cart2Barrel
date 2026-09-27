"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrels,
} from "@/db/schema";
import { getPrimaryOutboundShippingPartner } from "@/data/barrel-outbound-shipping-partners";
import {
  approveOutboundOffPlatformPayment,
  setOutboundChargeBundleForBarrel,
} from "@/data/barrel-outbound-shipping-charges";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS } from "@/lib/barrel-outbound-shipping-charge";
import {
  approveOutboundOffPlatformPaymentSchema,
  parseUsdInputToCents,
  saveBarrelOutboundShippingChargeSchema,
  setBarrelOutboundChargeBundleSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type SaveBarrelOutboundShippingChargeState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveBarrelOutboundShippingChargeAction(
  raw: unknown,
): Promise<SaveBarrelOutboundShippingChargeState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = saveBarrelOutboundShippingChargeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    barrelId,
    chargeKind,
    partnerName,
    partnerLocation,
    partnerAddress,
    partnerCountry,
    adminNote,
    lines,
  } = parsed.data;
  const linePayload = lines.map((line, index) => ({
    label: line.label.trim(),
    amountCents: parseUsdInputToCents(line.amountUsd),
    sortIndex: index,
  }));

  if (linePayload.some((l) => l.amountCents <= 0)) {
    return { ok: false, message: "Each cost line must be greater than zero." };
  }

  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

  const [barrel] = await db
    .select({ clerkUserId: barrels.clerkUserId })
    .from(barrels)
    .where(eq(barrels.id, barrelId))
    .limit(1);

  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  const [existing] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.barrelId, barrelId),
        eq(barrelOutboundShippingCharges.chargeKind, chargeKind),
      ),
    )
    .limit(1);

  let chargeId = existing?.id;

  if (existing?.paidAt) {
    return {
      ok: false,
      message: "This charge was already paid and cannot be edited.",
    };
  }

  const primaryPartner = await getPrimaryOutboundShippingPartner(
    barrelId,
    chargeKind,
  );
  const partnerNameValue =
    primaryPartner?.name.trim() || partnerName.trim() || null;
  const partnerLocationValue =
    chargeKind === "freight"
      ? null
      : primaryPartner?.location?.trim() || partnerLocation.trim() || null;
  const partnerAddressValue =
    primaryPartner?.address?.trim() || partnerAddress.trim() || null;
  const partnerCountryValue =
    chargeKind === "freight"
      ? null
      : primaryPartner?.country?.trim() || partnerCountry.trim() || null;
  const partnerPhoneValue = primaryPartner?.phone?.trim() || null;
  const partnerCashappIdValue = primaryPartner?.cashappId?.trim() || null;
  const partnerCashappAccountValue = primaryPartner?.cashappAccount?.trim() || null;
  const partnerZelleIdValue = primaryPartner?.zelleId?.trim() || null;
  const partnerZelleAccountValue = primaryPartner?.zelleAccount?.trim() || null;

  if (chargeId) {
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        adminNote: adminNote.trim() || null,
        partnerName: partnerNameValue,
        partnerLocation: partnerLocationValue,
        partnerAddress: partnerAddressValue,
        partnerCountry: partnerCountryValue,
        partnerPhone: partnerPhoneValue,
        partnerCashappId: partnerCashappIdValue,
        partnerCashappAccount: partnerCashappAccountValue,
        partnerZelleId: partnerZelleIdValue,
        partnerZelleAccount: partnerZelleAccountValue,
        recordedByClerkUserId: cu.user.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(barrelOutboundShippingCharges.id, chargeId));

    await db
      .delete(barrelOutboundShippingChargeLines)
      .where(eq(barrelOutboundShippingChargeLines.chargeId, chargeId));
  } else {
    const [inserted] = await db
      .insert(barrelOutboundShippingCharges)
      .values({
        barrelId,
        clerkUserId: barrel.clerkUserId,
        chargeKind,
        partnerName: partnerNameValue,
        partnerLocation: partnerLocationValue,
        partnerAddress: partnerAddressValue,
        partnerCountry: partnerCountryValue,
        partnerPhone: partnerPhoneValue,
        partnerCashappId: partnerCashappIdValue,
        partnerCashappAccount: partnerCashappAccountValue,
        partnerZelleId: partnerZelleIdValue,
        partnerZelleAccount: partnerZelleAccountValue,
        adminNote: adminNote.trim() || null,
        recordedByClerkUserId: cu.user.id,
      })
      .returning({ id: barrelOutboundShippingCharges.id });
    chargeId = inserted?.id;
  }

  if (!chargeId) {
    return { ok: false, message: "Could not save shipping charge." };
  }

  await db.insert(barrelOutboundShippingChargeLines).values(
    linePayload.map((line) => ({
      chargeId,
      label: line.label,
      amountCents: line.amountCents,
      sortIndex: line.sortIndex,
    })),
  );

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");

  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[chargeKind];
  const customerAction =
    chargeKind === "freight"
      ? "The customer can add it to their cart on Shipping."
      : "The customer can pay it with Zelle, Cash App, or at the local office.";
  return {
    ok: true,
    message: `${kindLabel} published. ${customerAction}`,
  };
}

export async function approveOutboundOffPlatformPaymentAction(
  raw: unknown,
): Promise<SaveBarrelOutboundShippingChargeState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = approveOutboundOffPlatformPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid charge.",
    };
  }

  const result = await approveOutboundOffPlatformPayment(parsed.data.chargeId);
  if (!result.ok) return result;

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");
  return { ok: true, message: "Payment approved." };
}

export async function setBarrelOutboundChargeBundleAction(
  raw: unknown,
): Promise<SaveBarrelOutboundShippingChargeState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = setBarrelOutboundChargeBundleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid consolidation.",
    };
  }

  const result = await setOutboundChargeBundleForBarrel(parsed.data);
  if (!result.ok) return result;

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");
  const kinds = parsed.data.kinds;
  if (kinds.length < 2) {
    return { ok: true, message: "Charges are billed on separate tabs again." };
  }
  return {
    ok: true,
    message: `Consolidated ${kinds.join(", ")} into one customer charge.`,
  };
}
