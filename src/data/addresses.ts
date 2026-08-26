import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { addresses, profiles, type Address } from "@/db/schema";
import { isJamaicaShippingCountry } from "@/lib/shipping-countries";
import type { ShippingContactAddressFormInput } from "@/lib/validations/shipping-address";

export type SerializableShippingAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2: string | null;
  cityOrTown: string | null;
  parish: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
};

export function toSerializableShippingAddress(
  row: Address,
): SerializableShippingAddress {
  return {
    id: row.id,
    label: row.label?.trim() || null,
    recipientName: row.recipientName?.trim() ?? "",
    recipientPhone: row.recipientPhone?.trim() ?? "",
    line1: row.line1,
    line2: row.line2,
    cityOrTown: row.cityOrTown,
    parish: row.parish,
    postalCode: row.postalCode,
    country: row.country,
    isDefault: row.isDefault,
  };
}

export async function listShippingAddressesForUser(
  clerkUserId: string,
): Promise<Address[]> {
  const db = getDb();
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.clerkUserId, clerkUserId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function getShippingAddressForUser(
  clerkUserId: string,
  addressId: string,
): Promise<Address | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.clerkUserId, clerkUserId), eq(addresses.id, addressId)))
    .limit(1);
  return row;
}

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
      map.set(row.clerkUserId, row);
      continue;
    }
    if (row.isDefault && !existing.isDefault) {
      map.set(row.clerkUserId, row);
    }
  }
  return map;
}

export async function listShippingAddressesByClerkUserIds(
  clerkUserIds: string[],
): Promise<Map<string, Address[]>> {
  const ids = [...new Set(clerkUserIds)].filter(Boolean);
  const map = new Map<string, Address[]>();
  if (ids.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(addresses)
    .where(inArray(addresses.clerkUserId, ids))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  for (const row of rows) {
    const list = map.get(row.clerkUserId) ?? [];
    list.push(row);
    map.set(row.clerkUserId, list);
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

async function syncProfileContact(
  clerkUserId: string,
  fullName: string,
  phone: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(profiles)
    .set({
      fullName,
      phone,
      profileCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.clerkUserId, clerkUserId));
}

async function setOnlyPrimary(
  clerkUserId: string,
  addressId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.clerkUserId, clerkUserId), ne(addresses.id, addressId)));
  await db
    .update(addresses)
    .set({ isDefault: true })
    .where(and(eq(addresses.clerkUserId, clerkUserId), eq(addresses.id, addressId)));
}

export async function upsertShippingContactAddress(input: {
  clerkUserId: string;
  data: ShippingContactAddressFormInput;
}): Promise<Address> {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await listShippingAddressesForUser(input.clerkUserId);
  const editing = input.data.id
    ? existing.find((row) => row.id === input.data.id)
    : undefined;
  const makePrimary =
    Boolean(input.data.isPrimary) ||
    existing.length === 0 ||
    Boolean(editing?.isDefault);
  const values = {
    label: input.data.label?.trim() || (makePrimary ? "Primary" : "Shipping"),
    recipientName: input.data.fullName,
    recipientPhone: input.data.phone,
    line1: input.data.line1,
    line2: input.data.line2 ?? null,
    cityOrTown: input.data.cityOrTown,
    parish: input.data.stateOrRegion,
    postalCode: input.data.postalCode ?? null,
    country: input.data.country,
  };

  let saved: Address | undefined;
  if (input.data.id) {
    const owned = await getShippingAddressForUser(input.clerkUserId, input.data.id);
    if (!owned) {
      throw new Error("Address not found.");
    }
    const [updated] = await db
      .update(addresses)
      .set(values)
      .where(
        and(
          eq(addresses.clerkUserId, input.clerkUserId),
          eq(addresses.id, input.data.id),
        ),
      )
      .returning();
    saved = updated;
  } else {
    const [created] = await db
      .insert(addresses)
      .values({
        clerkUserId: input.clerkUserId,
        ...values,
        isDefault: makePrimary,
        createdAt: now,
      })
      .returning();
    saved = created;
  }

  if (!saved) {
    throw new Error("Could not save shipping address.");
  }

  if (makePrimary) {
    await setOnlyPrimary(input.clerkUserId, saved.id);
    await syncProfileContact(input.clerkUserId, input.data.fullName, input.data.phone);
  }

  const [fresh] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, saved.id))
    .limit(1);
  return fresh ?? saved;
}

export async function setPrimaryShippingAddressForUser(
  clerkUserId: string,
  addressId: string,
): Promise<boolean> {
  const owned = await getShippingAddressForUser(clerkUserId, addressId);
  if (!owned) return false;
  await setOnlyPrimary(clerkUserId, addressId);
  if (owned.recipientName?.trim() && owned.recipientPhone?.trim()) {
    await syncProfileContact(
      clerkUserId,
      owned.recipientName.trim(),
      owned.recipientPhone.trim(),
    );
  }
  return true;
}

export async function deleteShippingAddressForUser(
  clerkUserId: string,
  addressId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const rows = await listShippingAddressesForUser(clerkUserId);
  const target = rows.find((row) => row.id === addressId);
  if (!target) {
    return { ok: false, message: "Address not found." };
  }
  if (rows.length === 1) {
    return { ok: false, message: "Keep at least one shipping address on file." };
  }
  const db = getDb();
  await db
    .delete(addresses)
    .where(and(eq(addresses.clerkUserId, clerkUserId), eq(addresses.id, addressId)));
  if (target.isDefault) {
    const remaining = rows.filter((row) => row.id !== addressId);
    const next = remaining[0];
    if (next) {
      await setPrimaryShippingAddressForUser(clerkUserId, next.id);
    }
  }
  return { ok: true };
}
