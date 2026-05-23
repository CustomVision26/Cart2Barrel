"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getOrCreateProfile } from "@/data/profiles";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

/** Let a signed-in user browse the storefront without finishing contact/shipping yet. */
export async function skipOnboardingAction(): Promise<void> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  await getOrCreateProfile(userId, null);

  const now = new Date().toISOString();
  const db = getDb();
  await db
    .update(profiles)
    .set({
      onboardingSkippedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.clerkUserId, userId));

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect("/");
}
