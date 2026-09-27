"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { userOutboundShippingCartLines } from "@/db/schema";
import { getOutboundShippingChargeForUser } from "@/data/barrel-outbound-shipping-charges";
import { expandChargeIdsWithCompanyRateLinks } from "@/data/outbound-shipping-company-rate-links";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import {
  addOutboundShippingChargeToCartSchema,
  removeOutboundShippingChargeFromCartSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type OutboundShippingCartActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export async function addOutboundShippingChargeToCartAction(
  raw: unknown,
): Promise<OutboundShippingCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = addOutboundShippingChargeToCartSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { chargeId } = parsed.data;
  const row = await getOutboundShippingChargeForUser(userId, chargeId);
  if (!row) {
    return { ok: false, message: "Shipping charge not found." };
  }

  if (row.charge.paidAt) {
    return { ok: false, message: "This shipping charge was already paid." };
  }

  if (row.charge.chargeKind !== "freight") {
    return {
      ok: false,
      message:
        "Broker and local courier charges are paid with Zelle, Cash App, or at the local office — not through the cart.",
    };
  }

  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const linkedIds = await expandChargeIdsWithCompanyRateLinks({
    clerkUserId: userId,
    chargeIds: [chargeId],
  });
  if (linkedIds.length > 1) {
    await db
      .delete(userOutboundShippingCartLines)
      .where(
        and(
          eq(userOutboundShippingCartLines.clerkUserId, userId),
          inArray(userOutboundShippingCartLines.chargeId, linkedIds),
        ),
      );
  }

  await db
    .insert(userOutboundShippingCartLines)
    .values({
      clerkUserId: userId,
      chargeId,
    })
    .onConflictDoNothing();

  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/cart");
  return { ok: true, message: "Added to cart." };
}

export async function removeOutboundShippingChargeFromCartAction(
  raw: unknown,
): Promise<OutboundShippingCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = removeOutboundShippingChargeFromCartSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { chargeId } = parsed.data;
  const linkedIds = await expandChargeIdsWithCompanyRateLinks({
    clerkUserId: userId,
    chargeIds: [chargeId],
  });
  const db = getDb();
  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, userId),
        inArray(
          userOutboundShippingCartLines.chargeId,
          linkedIds.length > 0 ? linkedIds : [chargeId],
        ),
      ),
    );

  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/cart");
  return { ok: true };
}
