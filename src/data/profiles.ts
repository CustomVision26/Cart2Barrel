import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles, type Profile } from "@/db/schema";

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
  const existing = await getProfileByClerkId(clerkUserId);
  if (existing) {
    if (email && existing.email !== email) {
      const [updated] = await db
        .update(profiles)
        .set({ email, updatedAt: new Date().toISOString() })
        .where(eq(profiles.clerkUserId, clerkUserId))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }
  const [inserted] = await db
    .insert(profiles)
    .values({
      clerkUserId,
      email: email ?? undefined,
    })
    .returning();
  return inserted;
}

export function isProfileComplete(profile: Profile): boolean {
  return Boolean(
    profile.fullName &&
      profile.phone &&
      profile.addressLine1 &&
      profile.cityOrTown &&
      profile.parish &&
      profile.profileCompletedAt
  );
}
