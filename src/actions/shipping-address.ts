"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { addresses } from "@/db/schema";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { getOrCreateProfile } from "@/data/profiles";
import {
  parseShippingAddressFormSubmission,
  resolveShippingAfterSaveRedirect,
} from "@/lib/validations/shipping-address-payload";

export type SaveShippingAddressState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function saveShippingAddressAction(
  _prev: SaveShippingAddressState,
  rawInput: unknown
): Promise<SaveShippingAddressState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to save your address." };
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;
  await getOrCreateProfile(userId, email);

  const parsed = parseShippingAddressFormSubmission(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors };
  }

  const now = new Date().toISOString();
  const db = getDb();

  const primary = await getPrimaryShippingAddress(userId);

  if (!primary) {
    await db.insert(addresses).values({
      clerkUserId: userId,
      label: "Default",
      line1: parsed.data.line1,
      line2: parsed.data.line2 ?? null,
      cityOrTown: parsed.data.cityOrTown,
      parish: parsed.data.stateOrRegion,
      postalCode: parsed.data.postalCode ?? null,
      country: parsed.data.country,
      isDefault: true,
      createdAt: now,
    });
  } else {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(
        and(eq(addresses.clerkUserId, userId), ne(addresses.id, primary.id)),
      );
    await db
      .update(addresses)
      .set({
        label: "Default",
        line1: parsed.data.line1,
        line2: parsed.data.line2 ?? null,
        cityOrTown: parsed.data.cityOrTown,
        parish: parsed.data.stateOrRegion,
        postalCode: parsed.data.postalCode ?? null,
        country: parsed.data.country,
        isDefault: true,
      })
      .where(eq(addresses.id, primary.id));
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/settings/delivery");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/address");
  redirect(resolveShippingAfterSaveRedirect(rawInput));
}
