"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getOrCreateProfile } from "@/data/profiles";
import { parseProfileFormSubmission, resolveAfterSaveRedirect } from "@/lib/validations/profile-payload";

export type SaveProfileState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Legal / billing contact (name & phone). Shipping street lines live on `addresses`. */
export async function saveContactProfileAction(
  _prev: SaveProfileState,
  rawInput: unknown
): Promise<SaveProfileState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to save your profile." };
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;
  await getOrCreateProfile(userId, email);

  const parsed = parseProfileFormSubmission(rawInput);

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

  await db
    .update(profiles)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      profileCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.clerkUserId, userId));

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/settings/delivery");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/address");
  redirect(resolveAfterSaveRedirect(rawInput));
}
