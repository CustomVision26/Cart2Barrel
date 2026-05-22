import { clerkClient } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { adminRoleGrants } from "@/db/schema";
import {
  clerkPublicMetadataRole,
  isClerkStaffRole,
} from "@/lib/is-clerk-admin";

const CLERK_USER_LOOKUP_CHUNK = 20;
const CLERK_EMAIL_LOOKUP_CHUNK = 10;

export type AdminProfileStaffRow = {
  clerkUserId: string;
  email: string | null;
};

function clerkUserEmails(user: User): string[] {
  const emails: string[] = [];
  for (const entry of user.emailAddresses ?? []) {
    const addr = entry.emailAddress?.trim().toLowerCase();
    if (addr) emails.push(addr);
  }
  return emails;
}

function markStaffFromClerkUser(
  staff: Set<string>,
  user: User,
  profileIdsByEmail: Map<string, string[]>,
): void {
  if (!isClerkStaffRole(clerkPublicMetadataRole(user.publicMetadata))) {
    return;
  }
  staff.add(user.id);
  for (const email of clerkUserEmails(user)) {
    const profileIds = profileIdsByEmail.get(email);
    if (profileIds) {
      for (const profileId of profileIds) {
        staff.add(profileId);
      }
    }
  }
}

async function staffClerkUserIdsFromGrantLog(): Promise<Set<string>> {
  const db = getDb();
  try {
    const rows = await db
      .selectDistinct({ clerkUserId: adminRoleGrants.targetClerkUserId })
      .from(adminRoleGrants);
    return new Set(rows.map((r) => r.clerkUserId));
  } catch {
    return new Set();
  }
}

/**
 * Resolves every profile `clerkUserId` that should be treated as staff/admin:
 * grant log, Clerk `publicMetadata` on the profile id, and any Clerk user with the same email.
 */
export async function resolveStaffClerkUserIds(
  rows: AdminProfileStaffRow[],
): Promise<Set<string>> {
  const staff = await staffClerkUserIdsFromGrantLog();
  if (rows.length === 0) {
    return staff;
  }

  const profileIdsByEmail = new Map<string, string[]>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const existing = profileIdsByEmail.get(email) ?? [];
    existing.push(row.clerkUserId);
    profileIdsByEmail.set(email, existing);
  }

  try {
    const client = await clerkClient();

    for (let i = 0; i < rows.length; i += CLERK_USER_LOOKUP_CHUNK) {
      const chunk = rows.slice(i, i + CLERK_USER_LOOKUP_CHUNK);
      await Promise.all(
        chunk.map(async ({ clerkUserId }) => {
          try {
            const user = await client.users.getUser(clerkUserId);
            markStaffFromClerkUser(staff, user, profileIdsByEmail);
          } catch {
            /* profile id may not exist in Clerk */
          }
        }),
      );
    }

    const emails = [...profileIdsByEmail.keys()];
    for (let i = 0; i < emails.length; i += CLERK_EMAIL_LOOKUP_CHUNK) {
      const chunk = emails.slice(i, i + CLERK_EMAIL_LOOKUP_CHUNK);
      await Promise.all(
        chunk.map(async (email) => {
          try {
            const result = await client.users.getUserList({
              emailAddress: [email],
              limit: 10,
            });
            for (const user of result.data) {
              markStaffFromClerkUser(staff, user, profileIdsByEmail);
            }
          } catch {
            /* email lookup failed */
          }
        }),
      );
    }
  } catch {
    return staff;
  }

  return staff;
}
