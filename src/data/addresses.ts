import { and, desc, eq } from "drizzle-orm";

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
