import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { addresses, type Address } from "@/db/schema";
import { isJamaicaShippingCountry } from "@/lib/shipping-countries";

/** Prefer default row, else most recently created. */
export async function getPrimaryShippingAddress(
  clerkUserId: string,
): Promise<Address | undefined> {
  const db = getDb();
  const byDefault = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.clerkUserId, clerkUserId), eq(addresses.isDefault, true)))
    .limit(1);
  if (byDefault[0]) {
    return byDefault[0];
  }
  const latest = await db
    .select()
    .from(addresses)
    .where(eq(addresses.clerkUserId, clerkUserId))
    .orderBy(desc(addresses.createdAt))
    .limit(1);
  return latest[0];
}

/** Batch variant of {@link getPrimaryShippingAddress} for many users at once. */
export async function getPrimaryShippingAddressesByClerkUserIds(
  clerkUserIds: string[],
): Promise<Map<string, Address>> {
  const ids = [...new Set(clerkUserIds)].filter(Boolean);
  if (ids.length === 0) {
    return new Map();
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(addresses)
    .where(inArray(addresses.clerkUserId, ids))
    .orderBy(desc(addresses.createdAt));

  const map = new Map<string, Address>();
  for (const row of rows) {
    const existing = map.get(row.clerkUserId);
    if (!existing) {
      // Rows are newest-first, so the first seen is the latest fallback.
      map.set(row.clerkUserId, row);
      continue;
    }
    // Prefer an explicit default over the most recent address.
    if (row.isDefault && !existing.isDefault) {
      map.set(row.clerkUserId, row);
    }
  }
  return map;
}

export function isShippingAddressComplete(addr: Address | undefined): boolean {
  if (!addr) return false;
  const hasCore = Boolean(
    addr.line1?.trim() &&
      addr.cityOrTown?.trim() &&
      addr.parish?.trim() &&
      addr.country?.trim(),
  );
  if (!hasCore) return false;
  if (isJamaicaShippingCountry(addr.country)) return true;
  return Boolean(addr.postalCode?.trim());
}
