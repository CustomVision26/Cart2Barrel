import "server-only";

import { asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { hubShipFromAddresses, hubShipFromSettings } from "@/db/schema";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { usStateToAbbreviation } from "@/lib/us-states";

const HUB_KEY = "default";

let addressesTableEnsured = false;

async function ensureHubShipFromAddressesTable(): Promise<void> {
  await ensureHubStockSchemaEnums();
  if (addressesTableEnsured) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "hub_ship_from_addresses" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "phone" text NOT NULL,
      "line1" text NOT NULL,
      "line2" text,
      "city" text NOT NULL,
      "state" text NOT NULL,
      "postal_code" text NOT NULL,
      "country" text DEFAULT 'United States' NOT NULL,
      "is_primary" boolean DEFAULT false NOT NULL,
      "updated_by_clerk_user_id" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "hub_ship_from_addresses_is_primary_idx"
    ON "hub_ship_from_addresses" ("is_primary")
  `);
  addressesTableEnsured = true;
}

export type HubShipFromAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type HubShipFromAddressRecord = HubShipFromAddress & {
  id: string;
  isPrimary: boolean;
};

function envFallback(): HubShipFromAddress {
  return {
    name: process.env.HUB_SHIP_FROM_NAME?.trim() ?? "",
    phone: process.env.HUB_SHIP_FROM_PHONE?.trim() ?? "",
    line1: process.env.HUB_SHIP_FROM_LINE1?.trim() ?? "",
    line2: process.env.HUB_SHIP_FROM_LINE2?.trim() ?? "",
    city: process.env.HUB_SHIP_FROM_CITY?.trim() ?? "",
    state: process.env.HUB_SHIP_FROM_STATE?.trim() ?? "",
    postalCode: process.env.HUB_SHIP_FROM_ZIP?.trim() ?? "",
    country: process.env.HUB_SHIP_FROM_COUNTRY?.trim() || "United States",
  };
}

function mapRow(row: {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}): HubShipFromAddressRecord {
  return {
    id: row.id,
    name: row.name.trim(),
    phone: row.phone.trim(),
    line1: row.line1.trim(),
    line2: row.line2?.trim() ?? "",
    city: row.city.trim(),
    state: row.state.trim(),
    postalCode: row.postalCode.trim(),
    country: row.country.trim() || "United States",
    isPrimary: row.isPrimary,
  };
}

function addressDedupeKey(row: {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): string {
  return [
    row.name.trim().toLowerCase(),
    row.phone.replace(/\D/g, ""),
    row.line1.trim().toLowerCase(),
    (row.line2 ?? "").trim().toLowerCase(),
    row.city.trim().toLowerCase(),
    row.state.trim().toLowerCase(),
    row.postalCode.trim(),
  ].join("|");
}

async function backfillFromSingletonIfNeeded(): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: hubShipFromAddresses.id })
    .from(hubShipFromAddresses)
    .limit(1);
  if (existing) return;

  const [legacy] = await db
    .select()
    .from(hubShipFromSettings)
    .where(eq(hubShipFromSettings.singletonKey, HUB_KEY))
    .limit(1);
  if (!legacy) return;
  if (
    !legacy.name?.trim() &&
    !legacy.line1?.trim() &&
    !legacy.city?.trim() &&
    !legacy.postalCode?.trim()
  ) {
    return;
  }

  const now = new Date().toISOString();
  await db.insert(hubShipFromAddresses).values({
    name: legacy.name?.trim() || "Warehouse",
    phone: legacy.phone?.trim() || "",
    line1: legacy.line1?.trim() || "",
    line2: legacy.line2?.trim() || null,
    city: legacy.city?.trim() || "",
    state: legacy.state?.trim() || "",
    postalCode: legacy.postalCode?.trim() || "",
    country: legacy.country?.trim() || "United States",
    isPrimary: true,
    updatedByClerkUserId: legacy.updatedByClerkUserId,
    createdAt: now,
    updatedAt: legacy.updatedAt || now,
  });
}

async function setOnlyPrimary(addressId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(hubShipFromAddresses)
    .set({ isPrimary: false, updatedAt: now })
    .where(ne(hubShipFromAddresses.id, addressId));
  await db
    .update(hubShipFromAddresses)
    .set({ isPrimary: true, updatedAt: now })
    .where(eq(hubShipFromAddresses.id, addressId));
}

async function dedupeIdenticalAddresses(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(hubShipFromAddresses)
    .orderBy(asc(hubShipFromAddresses.createdAt), asc(hubShipFromAddresses.id));
  if (rows.length < 2) return;

  const keepByKey = new Map<string, string>();
  const deleteIds: string[] = [];
  for (const row of rows) {
    const key = addressDedupeKey(row);
    if (keepByKey.has(key)) {
      deleteIds.push(row.id);
    } else {
      keepByKey.set(key, row.id);
    }
  }
  if (deleteIds.length === 0) return;
  await db
    .delete(hubShipFromAddresses)
    .where(inArray(hubShipFromAddresses.id, deleteIds));
}

async function ensureExactlyOnePrimary(
  rows: HubShipFromAddressRecord[],
): Promise<HubShipFromAddressRecord[]> {
  if (rows.length === 0) return rows;
  const primaries = rows.filter((row) => row.isPrimary);
  if (primaries.length === 1) return rows;
  const keeper = primaries[0] ?? rows[0];
  await setOnlyPrimary(keeper.id);
  return rows.map((row) => ({ ...row, isPrimary: row.id === keeper.id }));
}

export async function listHubShipFromAddresses(): Promise<
  HubShipFromAddressRecord[]
> {
  await ensureHubShipFromAddressesTable();
  await backfillFromSingletonIfNeeded();
  await dedupeIdenticalAddresses();
  const db = getDb();
  const rows = await db
    .select()
    .from(hubShipFromAddresses)
    .orderBy(
      desc(hubShipFromAddresses.isPrimary),
      desc(hubShipFromAddresses.createdAt),
    );
  return ensureExactlyOnePrimary(rows.map(mapRow));
}

export async function loadHubShipFromSettings(): Promise<HubShipFromAddress> {
  const fallback = envFallback();
  try {
    const addresses = await listHubShipFromAddresses();
    const primary = addresses.find((row) => row.isPrimary) ?? addresses[0];
    if (primary) {
      return {
        name: primary.name || fallback.name,
        phone: primary.phone || fallback.phone,
        line1: primary.line1 || fallback.line1,
        line2: primary.line2 || fallback.line2,
        city: primary.city || fallback.city,
        state: primary.state || fallback.state,
        postalCode: primary.postalCode || fallback.postalCode,
        country: primary.country || fallback.country || "United States",
      };
    }
  } catch {
    // fall through to env
  }
  return fallback;
}

export function isHubShipFromComplete(address: HubShipFromAddress): boolean {
  return Boolean(
    address.name.trim() &&
      address.line1.trim() &&
      address.city.trim() &&
      address.state.trim() &&
      address.postalCode.trim() &&
      usStateToAbbreviation(address.state) &&
      /^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim()),
  );
}

export async function upsertHubShipFromAddress(input: {
  id?: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  isPrimary: boolean;
  updatedByClerkUserId: string;
}): Promise<HubShipFromAddressRecord> {
  await ensureHubShipFromAddressesTable();
  await backfillFromSingletonIfNeeded();
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await listHubShipFromAddresses();
  const incomingKey = addressDedupeKey(input);
  const editing =
    (input.id ? existing.find((row) => row.id === input.id) : undefined) ??
    (!input.id ? existing.find((row) => addressDedupeKey(row) === incomingKey) : undefined);
  if (input.id && !existing.some((row) => row.id === input.id)) {
    throw new Error("Address not found.");
  }
  const makePrimary =
    input.isPrimary || existing.length === 0 || Boolean(editing?.isPrimary);
  const values = {
    name: input.name,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: "United States" as const,
    updatedByClerkUserId: input.updatedByClerkUserId,
    updatedAt: now,
  };

  let savedId = editing?.id ?? input.id;
  if (editing) {
    await db
      .update(hubShipFromAddresses)
      .set(values)
      .where(eq(hubShipFromAddresses.id, editing.id));
  } else {
    const [created] = await db
      .insert(hubShipFromAddresses)
      .values({
        ...values,
        isPrimary: makePrimary,
        createdAt: now,
      })
      .returning({ id: hubShipFromAddresses.id });
    if (!created) {
      throw new Error("Could not save the ship-from address.");
    }
    savedId = created.id;
  }

  if (!savedId) {
    throw new Error("Could not save the ship-from address.");
  }
  if (makePrimary) {
    await setOnlyPrimary(savedId);
  }

  const fresh = await listHubShipFromAddresses();
  const record = fresh.find((row) => row.id === savedId);
  if (!record) {
    throw new Error("Could not save the ship-from address.");
  }
  return record;
}

export async function setPrimaryHubShipFromAddress(
  addressId: string,
): Promise<boolean> {
  await ensureHubShipFromAddressesTable();
  const db = getDb();
  const [row] = await db
    .select({ id: hubShipFromAddresses.id })
    .from(hubShipFromAddresses)
    .where(eq(hubShipFromAddresses.id, addressId))
    .limit(1);
  if (!row) return false;
  await setOnlyPrimary(addressId);
  return true;
}

export async function deleteHubShipFromAddress(
  addressId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureHubShipFromAddressesTable();
  const rows = await listHubShipFromAddresses();
  const target = rows.find((row) => row.id === addressId);
  if (!target) {
    return { ok: false, message: "Address not found." };
  }
  const db = getDb();
  await db
    .delete(hubShipFromAddresses)
    .where(eq(hubShipFromAddresses.id, addressId));
  if (target.isPrimary) {
    const remaining = rows.filter((row) => row.id !== addressId);
    if (remaining[0]) {
      await setOnlyPrimary(remaining[0].id);
    }
  }
  return { ok: true };
}
