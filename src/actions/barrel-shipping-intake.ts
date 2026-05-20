"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { barrelShippingIntakes, barrels } from "@/db/schema";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import { getBarrelForShippingIntake } from "@/data/barrel-shipping-intake";
import { isContainerReadyForShippingIntake } from "@/lib/barrel-shipping-intake";
import {
  BARREL_SHIPPING_INTAKE_PLACEHOLDER_DELIVERY_METHOD,
  cancelBarrelShippingIntakeSchema,
  submitBarrelShippingIntakeSchema,
} from "@/lib/validations/barrel-shipping-intake";

export type SubmitBarrelShippingIntakeState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type CancelBarrelShippingIntakeState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitBarrelShippingIntakeAction(
  raw: unknown,
): Promise<SubmitBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = submitBarrelShippingIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { barrelId } = parsed.data;

  const row = await getBarrelForShippingIntake(userId, barrelId);
  if (!row) {
    return { ok: false, message: "Container not found." };
  }

  if (row.intake) {
    return {
      ok: false,
      message: "This container was already confirmed for shipping charges.",
    };
  }

  if (
    !isContainerReadyForShippingIntake({
      status: row.barrel.status,
      capacityPercentage: row.barrel.capacityPercentage,
    })
  ) {
    return {
      ok: false,
      message:
        "This container is not full yet. Shipping options unlock at 100% load or when marked ready to ship.",
    };
  }

  await ensureBarrelShippingIntakesSchema();

  const now = new Date().toISOString();
  const db = getDb();

  await db.insert(barrelShippingIntakes).values({
    barrelId,
    clerkUserId: userId,
    deliveryMethod: BARREL_SHIPPING_INTAKE_PLACEHOLDER_DELIVERY_METHOD,
    deliveryAddressId: null,
    contactPhone: null,
    specialInstructions: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message: "Container marked ready for shipping charges. Open the Pricing tab when staff publish your quote.",
  };
}

export async function cancelBarrelShippingIntakeAction(
  raw: unknown,
): Promise<CancelBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to cancel." };
  }

  const parsed = cancelBarrelShippingIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  await ensureBarrelShippingIntakesSchema();

  const db = getDb();
  const { intakeId } = parsed.data;

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
        eq(barrelShippingIntakes.clerkUserId, userId),
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

  await db
    .delete(barrelShippingIntakes)
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, userId),
      )!,
    );

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message: "Confirmation cancelled. You can continue to pricing again when ready.",
  };
}
