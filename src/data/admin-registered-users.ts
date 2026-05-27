import { desc } from "drizzle-orm";

import { resolveStaffClerkUserIds } from "@/data/admin-staff-clerk-ids";
import { filterProfilesToActiveClerkUsers } from "@/data/filter-profiles-to-active-clerk-users";
import type { AdminProfileAccountKind } from "@/data/customer-pricing-packages";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { clerkBannedStatusByUserIds } from "@/lib/clerk-user-ban";
import { profileDisplayName } from "@/lib/profile-display-name";

export type AdminRegisteredUserRow = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  createdAt: string;
  banned: boolean;
  accountKind: AdminProfileAccountKind;
};

/** Every profile row (registered account) with Clerk ban status. */
export async function listRegisteredUsersForAdmin(): Promise<
  AdminRegisteredUserRow[]
> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        clerkUserId: profiles.clerkUserId,
        fullName: profiles.fullName,
        email: profiles.email,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    const activeRows = await filterProfilesToActiveClerkUsers(rows);

    const staffIds = await resolveStaffClerkUserIds(
      activeRows.map((r) => ({
        clerkUserId: r.clerkUserId,
        email: r.email,
      })),
    );
    const bannedById = await clerkBannedStatusByUserIds(
      activeRows.map((r) => r.clerkUserId),
    );

    return activeRows.map((r) => {
      const email = r.email?.trim() || null;
      return {
        clerkUserId: r.clerkUserId,
        displayName: profileDisplayName({
          fullName: r.fullName,
          email,
          clerkUserId: r.clerkUserId,
        }),
        email,
        createdAt: r.createdAt,
        banned: bannedById.get(r.clerkUserId) ?? false,
        accountKind: staffIds.has(r.clerkUserId) ? "admin" : "customer",
      };
    });
  } catch {
    return [];
  }
}
