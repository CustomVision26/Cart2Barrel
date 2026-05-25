import "server-only";

import { loadAdminCustomerProfilesByClerkUserIds } from "@/data/admin-customer-profiles";

import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";

export function uniqueClerkUserIds(
  ...lists: (string | null | undefined)[][]
): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      const trimmed = id?.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set];
}

export async function loadAdminStaffProfilesByClerkUserIds(
  ids: (string | null | undefined)[],
): Promise<AdminStaffProfilesByClerkUserId> {
  return loadAdminCustomerProfilesByClerkUserIds(uniqueClerkUserIds(ids));
}
