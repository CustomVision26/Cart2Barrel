import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles, type Profile } from "@/db/schema";

import {
  getPrimaryShippingAddress,
  isShippingAddressComplete,
} from "@/data/addresses";

export async function getProfileByClerkId(
  clerkUserId: string
): Promise<Profile | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0];
}

export async function getOrCreateProfile(
  clerkUserId: string,
  email: string | null
): Promise<Profile> {
  const db = getDb();
  const now = new Date().toISOString();
  const normalizedEmail =
    email != null && email.trim() !== "" ? email.trim() : null;

  const [row] = await db
    .insert(profiles)
    .values({
      clerkUserId,
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: profiles.clerkUserId,
      set: {
        updatedAt: now,
        ...(normalizedEmail != null ? { email: normalizedEmail } : {}),
      },
    })
    .returning();

  if (!row) {
    const existing = await getProfileByClerkId(clerkUserId);
    if (existing) return existing;
    throw new Error("Failed to create profile");
  }
  return row;
}

/** Name + phone for account / billing / legal contact (not shipping street). */
export function isContactProfileComplete(profile: Profile): boolean {
  return Boolean(profile.fullName?.trim() && profile.phone?.trim());
}

/** Contact row saved at least once (audit). */
export function hasSavedContactStep(profile: Profile): boolean {
  return Boolean(profile.profileCompletedAt);
}

export async function isOnboardingComplete(
  clerkUserId: string,
  profile: Profile
): Promise<boolean> {
  if (profile.onboardingSkippedAt) {
    return true;
  }
  if (!isContactProfileComplete(profile) || !hasSavedContactStep(profile)) {
    return false;
  }
  const addr = await getPrimaryShippingAddress(clerkUserId);
  return isShippingAddressComplete(addr);
}
