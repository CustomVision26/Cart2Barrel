import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { purgeProfileByClerkUserId } from "@/data/purge-profile-by-clerk-user-id";
import { clerkUserExists } from "@/lib/clerk-user-exists";

const CLERK_CHECK_CHUNK = 40;

function clerkErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeClerkUserIds(clerkUserIds: string[]): string[] {
  return [...new Set(clerkUserIds.map((id) => id.trim()).filter(Boolean))];
}

async function existingClerkUserIds(
  clerkUserIds: string[],
): Promise<Set<string> | null> {
  const ids = normalizeClerkUserIds(clerkUserIds);
  if (ids.length === 0) return new Set();

  try {
    const client = await clerkClient();
    const found = new Set<string>();

    for (let i = 0; i < ids.length; i += CLERK_CHECK_CHUNK) {
      const chunk = ids.slice(i, i + CLERK_CHECK_CHUNK);
      try {
        const page = await client.users.getUserList({
          userId: chunk,
          limit: chunk.length,
        });
        for (const user of page.data) {
          found.add(user.id);
        }
      } catch (chunkError) {
        console.warn(
          "[Cart2Barrel] Clerk getUserList chunk failed while filtering admin profiles:",
          clerkErrorMessage(chunkError),
        );
        for (const clerkUserId of chunk) {
          const exists = await clerkUserExists(clerkUserId);
          if (exists === true) {
            found.add(clerkUserId);
          }
        }
      }
    }

    return found;
  } catch (error) {
    console.warn(
      "[Cart2Barrel] Clerk batch lookup failed while filtering admin profiles:",
      clerkErrorMessage(error),
    );
    return null;
  }
}

/**
 * Drops profiles whose Clerk account no longer exists and purges their DB data.
 * When Clerk is unreachable, rows are kept (no purge).
 */
export async function filterProfilesToActiveClerkUsers<
  T extends { clerkUserId: string },
>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return [];

  try {
    const existingIds = await existingClerkUserIds(rows.map((row) => row.clerkUserId));

    if (!existingIds) {
      return rows;
    }

    const kept: T[] = [];
    for (const row of rows) {
      if (existingIds.has(row.clerkUserId)) {
        kept.push(row);
        continue;
      }
      try {
        // No revalidateTag/Path here — this runs during RSC layout/render.
        await purgeProfileByClerkUserId(row.clerkUserId, { revalidate: false });
      } catch (error) {
        console.warn(
          "[Cart2Barrel] purgeProfileByClerkUserId failed:",
          row.clerkUserId,
          clerkErrorMessage(error),
        );
      }
      // Always hide from admin picker once Clerk says the user is gone,
      // even if DB purge hits a foreign-key error.
    }
    return kept;
  } catch (error) {
    console.warn(
      "[Cart2Barrel] filterProfilesToActiveClerkUsers failed:",
      clerkErrorMessage(error),
    );
    return rows;
  }
}
