import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/data/profiles";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { profiles } from "@/db/schema";

const CLERK_USER_PAGE_SIZE = 100;

function clerkPrimaryEmail(user: User): string | null {
  const primaryId = user.primaryEmailAddressId;
  const fromPrimary =
    primaryId ?
      user.emailAddresses.find((entry) => entry.id === primaryId)?.emailAddress
    : user.emailAddresses[0]?.emailAddress;
  const trimmed = fromPrimary?.trim();
  return trimmed || null;
}

function clerkFullName(user: User): string | null {
  const parts = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

async function listAllClerkUsers(): Promise<User[]> {
  const client = await clerkClient();
  const users: User[] = [];
  let offset = 0;
  for (;;) {
    const page = await client.users.getUserList({
      limit: CLERK_USER_PAGE_SIZE,
      offset,
    });
    users.push(...page.data);
    if (page.data.length < CLERK_USER_PAGE_SIZE) break;
    offset += CLERK_USER_PAGE_SIZE;
  }
  return users;
}

/**
 * Upserts a `profiles` row for every Clerk user so admin All users matches
 * registered accounts even when the Clerk webhook did not run.
 */
export async function syncProfilesFromClerkUsers(): Promise<number> {
  const users = await listAllClerkUsers();
  const db = getDb();
  let upserts = 0;

  for (const user of users) {
    const email = clerkPrimaryEmail(user);
    const fullName = clerkFullName(user);
    await getOrCreateProfile(user.id, email);
    upserts += 1;

    if (!fullName) continue;
    const existing = await db
      .select({ fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.clerkUserId, user.id))
      .limit(1);
    if (existing[0]?.fullName?.trim()) continue;
    await db
      .update(profiles)
      .set({
        fullName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.clerkUserId, user.id));
  }

  return upserts;
}
