"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { userOutboundShippingCartLines } from "@/db/schema";
import { getOutboundShippingChargeForUser } from "@/data/barrel-outbound-shipping-charges";
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

  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();

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
  const db = getDb();
  await db
    .delete(userOutboundShippingCartLines)
    .where(
      and(
        eq(userOutboundShippingCartLines.clerkUserId, userId),
        eq(userOutboundShippingCartLines.chargeId, chargeId),
      ),
    );

  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/cart");
  return { ok: true };
}
