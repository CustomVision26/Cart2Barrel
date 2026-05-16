"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { containerOfferings, userContainerCartLines } from "@/db/schema";
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
    .select({ id: containerOfferings.id })
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
        updatedAt: sql`now()`,
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
