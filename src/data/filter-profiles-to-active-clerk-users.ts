import "server-only";

import { clerkUserExists } from "@/lib/clerk-user-exists";
import { purgeProfileByClerkUserId } from "@/data/purge-profile-by-clerk-user-id";

const CLERK_CHECK_CHUNK = 15;

/**
 * Drops profiles whose Clerk account no longer exists and purges their DB data.
 * When Clerk is unreachable, rows are kept (no purge).
 */
export async function filterProfilesToActiveClerkUsers<
  T extends { clerkUserId: string },
>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return [];

  const kept: T[] = [];

  for (let i = 0; i < rows.length; i += CLERK_CHECK_CHUNK) {
    const chunk = rows.slice(i, i + CLERK_CHECK_CHUNK);
    const outcomes = await Promise.all(
      chunk.map(async (row) => {
        const exists = await clerkUserExists(row.clerkUserId);
        if (exists === false) {
          try {
            await purgeProfileByClerkUserId(row.clerkUserId);
          } catch (e) {
            console.error(
              "[Cart2Barrel] purgeProfileByClerkUserId failed:",
              row.clerkUserId,
              e,
            );
          }
          return null;
        }
        if (exists === true) {
          return row;
        }
        return row;
      }),
    );
    for (const row of outcomes) {
      if (row) kept.push(row);
    }
  }

  return kept;
}
