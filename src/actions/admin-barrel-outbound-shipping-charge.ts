"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrels,
} from "@/db/schema";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  parseUsdInputToCents,
  saveBarrelOutboundShippingChargeSchema,
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

  const { barrelId, adminNote, lines } = parsed.data;
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
    .where(eq(barrelOutboundShippingCharges.barrelId, barrelId))
    .limit(1);

  let chargeId = existing?.id;

  if (existing?.paidAt) {
    return {
      ok: false,
      message: "This shipping charge was already paid and cannot be edited.",
    };
  }

  if (chargeId) {
    await db
      .update(barrelOutboundShippingCharges)
      .set({
        adminNote: adminNote.trim() || null,
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
        adminNote: adminNote.trim() || null,
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

  return {
    ok: true,
    message: "Shipping charge saved. The customer can add it to their cart.",
  };
}
