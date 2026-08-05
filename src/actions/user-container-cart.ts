"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { containerOfferings, userContainerCartLines } from "@/db/schema";
import { sumUserSpecialSuitcaseCartQuantity } from "@/data/user-container-cart";
import { validateSpecialOfferSlotAvailabilityForCartLines } from "@/data/special-feature-suitcase-slots";
import { SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY } from "@/lib/special-feature-bag-fees";
import { userContainerCartMutationSchema } from "@/lib/validations/container-offering";

export type UserContainerCartActionState =
  | { ok: true }
  | { ok: false; message: string };

export async function setUserContainerCartQuantityAction(
  input: unknown,
): Promise<UserContainerCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = userContainerCartMutationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { offeringId, quantity } = parsed.data;

  const db = getDb();
  const [offering] = await db
    .select({
      id: containerOfferings.id,
      kind: containerOfferings.kind,
      name: containerOfferings.name,
      specialFeatureOfferId: containerOfferings.specialFeatureOfferId,
    })
    .from(containerOfferings)
    .where(
      and(
        eq(containerOfferings.id, offeringId),
        eq(containerOfferings.isActive, true),
      ),
    )
    .limit(1);

  if (!offering) {
    return { ok: false, message: "That container is not available." };
  }

  if (offering.kind === "suitcase") {
    const { listCurrentlyActiveSpecialFeatureOffers } = await import(
      "@/data/special-feature-offers"
    );
    const active = await listCurrentlyActiveSpecialFeatureOffers();
    const linkedSpecial = active.find(
      (o) =>
        o.packagingMode === "in_app" &&
        (o.containerOfferingId === offeringId ||
          (offering.specialFeatureOfferId != null &&
            o.id === offering.specialFeatureOfferId) ||
          o.name.trim() === offering.name.trim()),
    );
    if (!linkedSpecial) {
      return {
        ok: false,
        message: "That suitcase special is not available right now.",
      };
    }

    const nextTotal = await sumUserSpecialSuitcaseCartQuantity(userId, {
      setOfferingId: offeringId,
      setQuantity: quantity,
      extraOfferingsForPricing: [offering],
    });
    if (nextTotal > SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY) {
      return {
        ok: false,
        message: `Special suitcases are limited to ${SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY} total per offer (courier 2nd and 3rd bag capacity).`,
      };
    }

    const { listUserContainerCartWithOfferings } = await import(
      "@/data/user-container-cart"
    );
    const cartRows = await listUserContainerCartWithOfferings(userId);
    const projectedLines = cartRows
      .map((row) => ({
        offeringId: row.offering.id,
        quantity: row.offering.id === offeringId ? quantity : row.quantity,
      }))
      .filter((line) => line.quantity > 0);
    if (
      quantity > 0 &&
      !projectedLines.some((line) => line.offeringId === offeringId)
    ) {
      projectedLines.push({ offeringId, quantity });
    }
    const slotCheck = await validateSpecialOfferSlotAvailabilityForCartLines(
      projectedLines,
    );
    if (!slotCheck.ok) {
      return slotCheck;
    }
  }

  await db
    .insert(userContainerCartLines)
    .values({
      clerkUserId: userId,
      containerOfferingId: offeringId,
      quantity,
    })
    .onConflictDoUpdate({
      target: [
        userContainerCartLines.clerkUserId,
        userContainerCartLines.containerOfferingId,
      ],
      set: {
        quantity: sql`excluded.quantity`,
      },
    });

  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeUserContainerCartLineAction(input: {
  offeringId: string;
}): Promise<UserContainerCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }
  const offeringId =
    typeof input.offeringId === "string" ? input.offeringId.trim() : "";
  if (!offeringId) {
    return { ok: false, message: "Missing container." };
  }

  const db = getDb();
  await db
    .delete(userContainerCartLines)
    .where(
      and(
        eq(userContainerCartLines.clerkUserId, userId),
        eq(userContainerCartLines.containerOfferingId, offeringId),
      ),
    );

  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");
  return { ok: true };
}
