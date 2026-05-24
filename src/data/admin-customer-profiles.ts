import { clerkClient } from "@clerk/nextjs/server";
import { inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";

export type AdminCustomerProfileSlice = {
  fullName: string | null;
  email: string | null;
};

function clerkProfileSlice(user: {
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}): AdminCustomerProfileSlice {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const fullName = [first, last].filter(Boolean).join(" ") || null;
  const primary =
    user.primaryEmailAddressId ?
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress
    : user.emailAddresses[0]?.emailAddress;
  return {
    fullName,
    email: primary?.trim() || null,
  };
}

async function enrichProfilesFromClerk(
  result: Record<string, AdminCustomerProfileSlice>,
  clerkUserIds: string[],
): Promise<void> {
  const needsClerk = clerkUserIds.filter((id) => {
    const profile = result[id];
    return !profile?.fullName?.trim() && !profile?.email?.trim();
  });
  if (needsClerk.length === 0) return;

  try {
    const client = await clerkClient();
    await Promise.all(
      needsClerk.map(async (clerkUserId) => {
        try {
          const user = await client.users.getUser(clerkUserId);
          const fromClerk = clerkProfileSlice(user);
          const existing = result[clerkUserId];
          result[clerkUserId] = {
            fullName: existing?.fullName?.trim() || fromClerk.fullName,
            email: existing?.email?.trim() || fromClerk.email,
          };
        } catch {
          /* Clerk user may not exist */
        }
      }),
    );
  } catch {
    /* Clerk unavailable */
  }
}

export async function loadAdminCustomerProfilesByClerkUserIds(
  clerkUserIds: string[],
): Promise<Record<string, AdminCustomerProfileSlice>> {
  const unique = [...new Set(clerkUserIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const db = getDb();
  const rows = await db
    .select({
      clerkUserId: profiles.clerkUserId,
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(profiles)
    .where(inArray(profiles.clerkUserId, unique));

  const result = Object.fromEntries(
    rows.map((row) => [
      row.clerkUserId,
      { fullName: row.fullName, email: row.email },
    ]),
  ) as Record<string, AdminCustomerProfileSlice>;

  await enrichProfilesFromClerk(result, unique);
  return result;
}
